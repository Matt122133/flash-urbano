package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/correo"
	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

type arnesCodigo struct {
	h        *HandlersCodigo
	falso    *correo.Falso
	pool     *db.Pool
	ctx      context.Context
	registro *rastro.Registro
}

func arnesDePrueba(t *testing.T) *arnesCodigo {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("sin TEST_DATABASE_URL: se salta la prueba contra Postgres")
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 90*time.Second)
	t.Cleanup(cancelar)

	pool, err := db.Abrir(ctx, url)
	if err != nil {
		t.Fatalf("abriendo la base de prueba: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := db.Migrar(ctx, pool); err != nil {
		t.Fatalf("migrando: %v", err)
	}
	for _, tabla := range []string{"codigos_acceso", "rastro_ingresos", "usuarios"} {
		if _, err := pool.Exec(ctx, "DELETE FROM "+tabla); err != nil {
			t.Fatalf("limpiando %s: %v", tabla, err)
		}
	}

	falso := &correo.Falso{}
	registro := rastro.Nuevo(pool)

	return &arnesCodigo{
		h: NuevosHandlersCodigo(
			NuevosCodigos(pool),
			NuevosLimites(pool),
			falso,
			usuarios.Nuevo(pool),
			NuevasSesiones(pool, 24*time.Hour),
			registro,
		),
		falso:    falso,
		pool:     pool,
		ctx:      ctx,
		registro: registro,
	}
}

func (a *arnesCodigo) pedir(t *testing.T, cuerpo string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest("POST", "/auth/codigo", bytes.NewBufferString(cuerpo))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.h.Pedir(w, r)
	return w
}

func (a *arnesCodigo) verificar(t *testing.T, cuerpo string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest("POST", "/auth/codigo/verificar", bytes.NewBufferString(cuerpo))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.h.Verificar(w, r)
	return w
}

// TestPedirRespondeIgualExistaONoElUsuario es FR-014, y es la razon de ser del
// 204 sin cuerpo.
//
// Si la respuesta cambiara segun si la direccion esta registrada, este endpoint
// seria un verificador de cuentas: cualquiera podria averiguar quien es cliente
// de Diego probando direcciones.
func TestPedirRespondeIgualExistaONoElUsuario(t *testing.T) {
	a := arnesDePrueba(t)

	// Una direccion que YA es usuario.
	if _, err := usuarios.Nuevo(a.pool).BuscarOCrear(a.ctx, "existe@example.com"); err != nil {
		t.Fatalf("creando el usuario: %v", err)
	}

	conUsuario := a.pedir(t, `{"email":"existe@example.com"}`)
	sinUsuario := a.pedir(t, `{"email":"nadie@example.com"}`)

	if conUsuario.Code != sinUsuario.Code {
		t.Fatalf("los codigos difieren: con usuario %d, sin usuario %d", conUsuario.Code, sinUsuario.Code)
	}
	if conUsuario.Code != http.StatusNoContent {
		t.Fatalf("se esperaba 204 y dio %d", conUsuario.Code)
	}
	if conUsuario.Body.String() != sinUsuario.Body.String() {
		t.Fatalf("los cuerpos difieren: %q vs %q", conUsuario.Body.String(), sinUsuario.Body.String())
	}

	// Control positivo: los dos mandaron mail de verdad. Sin esto, un handler
	// que no hiciera nada pasaria la afirmacion de arriba perfectamente.
	if len(a.falso.Enviados()) != 2 {
		t.Fatalf("se esperaban 2 envios y hubo %d", len(a.falso.Enviados()))
	}
}

// TestPedirRespondeIgualConElLimiteExcedido: tampoco puede decir cuando
// conviene reintentar.
func TestPedirRespondeIgualConElLimiteExcedido(t *testing.T) {
	a := arnesDePrueba(t)

	const cuerpo = `{"email":"tope@example.com"}`
	var normal *httptest.ResponseRecorder
	for i := 0; i < maxPorEmail; i++ {
		normal = a.pedir(t, cuerpo)
	}
	enviadosAntes := len(a.falso.Enviados())

	excedido := a.pedir(t, cuerpo)

	if excedido.Code != normal.Code || excedido.Body.String() != normal.Body.String() {
		t.Fatalf("con el limite excedido la respuesta cambia: %d %q vs %d %q",
			excedido.Code, excedido.Body.String(), normal.Code, normal.Body.String())
	}
	// Pero NO se mando el mail: la respuesta es igual, el efecto no.
	if len(a.falso.Enviados()) != enviadosAntes {
		t.Fatalf("se mando mail pese al limite: antes %d, ahora %d", enviadosAntes, len(a.falso.Enviados()))
	}
	// Y el rastro sí distingue lo que la respuesta esconde (FR-022d).
	if n := a.contarRastro(t, "tope@example.com", "limite_excedido"); n != 1 {
		t.Fatalf("se esperaba 1 anotacion de limite_excedido y hubo %d", n)
	}
}

// TestElCaminoCompletoEntrega es el **control positivo de todo el archivo**.
//
// Las demas pruebas afirman que algo no se distingue o no pasa. Esta demuestra
// que el camino funciona de punta a punta: se pide, llega un codigo, se
// verifica, y sale una sesion con un usuario nuevo.
func TestElCaminoCompletoEntrega(t *testing.T) {
	a := arnesDePrueba(t)

	if w := a.pedir(t, `{"email":"nuevo@example.com"}`); w.Code != http.StatusNoContent {
		t.Fatalf("pedir dio %d", w.Code)
	}

	envio, hay := a.falso.Ultimo()
	if !hay {
		t.Fatal("no se mando ningun mail")
	}
	if envio.Destino != "nuevo@example.com" {
		t.Fatalf("el mail fue a %q", envio.Destino)
	}

	w := a.verificar(t, `{"email":"nuevo@example.com","codigo":"`+envio.Codigo+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("verificar dio %d: %s", w.Code, w.Body.String())
	}

	var respuesta respuestaSesion
	if err := json.Unmarshal(w.Body.Bytes(), &respuesta); err != nil {
		t.Fatalf("decodificando: %v", err)
	}
	if respuesta.Credencial == "" {
		t.Fatal("no vino credencial")
	}
	if respuesta.Usuario.Email != "nuevo@example.com" {
		t.Fatalf("el usuario es %q", respuesta.Usuario.Email)
	}
	// FR-021a: quien entra por codigo llega **sin nombre**. El alta se lo pide.
	if respuesta.Usuario.Nombre != "" {
		t.Fatalf("se precargo un nombre que no existe: %q", respuesta.Usuario.Nombre)
	}
	if respuesta.Usuario.PerfilCompleto {
		t.Fatal("el perfil no puede venir completo: todavia no dio nombre ni telefono")
	}
}

// TestUnCodigoIncorrectoYUnoVencidoSonIndistinguibles es la contracara de
// FR-014 en la verificacion.
func TestUnCodigoIncorrectoYUnoVencidoSonIndistinguibles(t *testing.T) {
	a := arnesDePrueba(t)

	a.pedir(t, `{"email":"comparar@example.com"}`)
	envio, _ := a.falso.Ultimo()

	incorrecto := a.verificar(t, `{"email":"comparar@example.com","codigo":"000001"}`)

	// Ahora se vence el que quedaba y se prueba con el valor CORRECTO.
	if _, err := a.pool.Exec(a.ctx, `UPDATE codigos_acceso SET expira_en = now() - interval '1 minute'`); err != nil {
		t.Fatalf("venciendo: %v", err)
	}
	vencido := a.verificar(t, `{"email":"comparar@example.com","codigo":"`+envio.Codigo+`"}`)

	if incorrecto.Code != vencido.Code || incorrecto.Body.String() != vencido.Body.String() {
		t.Fatalf("incorrecto y vencido se distinguen: %d %q vs %d %q",
			incorrecto.Code, incorrecto.Body.String(), vencido.Code, vencido.Body.String())
	}
	if incorrecto.Code != http.StatusUnauthorized {
		t.Fatalf("se esperaba 401 y dio %d", incorrecto.Code)
	}

	// Y adentro se distinguen, que es lo que permite reconstruir el intento.
	if n := a.contarRastro(t, "comparar@example.com", "codigo_incorrecto"); n != 1 {
		t.Fatalf("se esperaba 1 codigo_incorrecto y hubo %d", n)
	}
	if n := a.contarRastro(t, "comparar@example.com", "codigo_vencido"); n != 1 {
		t.Fatalf("se esperaba 1 codigo_vencido y hubo %d", n)
	}
}

// TestUnaDireccionQueNuncaPidioCodigoTampocoSeDistingue cierra el ultimo hueco:
// probar un codigo contra una direccion desconocida no puede revelar que es
// desconocida.
func TestUnaDireccionQueNuncaPidioCodigoTampocoSeDistingue(t *testing.T) {
	a := arnesDePrueba(t)

	a.pedir(t, `{"email":"pidio@example.com"}`)
	conCodigo := a.verificar(t, `{"email":"pidio@example.com","codigo":"000001"}`)
	sinCodigo := a.verificar(t, `{"email":"jamas@example.com","codigo":"000001"}`)

	if conCodigo.Code != sinCodigo.Code || conCodigo.Body.String() != sinCodigo.Body.String() {
		t.Fatalf("se distingue quien pidio codigo de quien no: %d %q vs %d %q",
			conCodigo.Code, conCodigo.Body.String(), sinCodigo.Code, sinCodigo.Body.String())
	}
}

// TestUnMailConFormaInvalidaSeRechaza: esto SI da 400, y no revela nada.
//
// Que "hola" no sea una direccion no depende de quien este registrado. Y evita
// llenar la tabla de codigos con basura que despues cuenta para los limites.
func TestUnMailConFormaInvalidaSeRechaza(t *testing.T) {
	a := arnesDePrueba(t)

	for _, malo := range []string{`""`, `"hola"`, `"sin@punto"`, `"@example.com"`, `"a@"`} {
		w := a.pedir(t, `{"email":`+malo+`}`)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("para %s se esperaba 400 y dio %d", malo, w.Code)
		}
	}
	if len(a.falso.Enviados()) != 0 {
		t.Fatalf("se mando mail a una direccion invalida: %+v", a.falso.Enviados())
	}
}

// TestSiElProveedorFallaLaRespuestaNoCambia: el precio declarado de FR-014.
//
// Un fallo del enviador no se ve desde afuera. Queda en el log, y por eso la
// fila `High` del tracker sobre supresion por rebote existe.
func TestSiElProveedorFallaLaRespuestaNoCambia(t *testing.T) {
	a := arnesDePrueba(t)

	bien := a.pedir(t, `{"email":"anda@example.com"}`)

	a.falso.Fallar = true
	mal := a.pedir(t, `{"email":"falla@example.com"}`)

	if bien.Code != mal.Code || bien.Body.String() != mal.Body.String() {
		t.Fatalf("un fallo del proveedor se ve desde afuera: %d %q vs %d %q",
			mal.Code, mal.Body.String(), bien.Code, bien.Body.String())
	}
}

func (a *arnesCodigo) contarRastro(t *testing.T, email, resultado string) int {
	t.Helper()
	var n int
	err := a.pool.QueryRow(a.ctx,
		`SELECT count(*) FROM rastro_ingresos WHERE email = $1 AND resultado = $2 AND camino = 'codigo'`,
		email, resultado).Scan(&n)
	if err != nil {
		t.Fatalf("contando el rastro: %v", err)
	}
	return n
}
