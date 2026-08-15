package pedidos

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Como en internal/db, internal/rastro e internal/usuarios, estas pruebas
// necesitan un Postgres real —con PostGIS— y **se saltan solas si no hay**.
//
// Que se salten solas es la trampa de este repo: "todo verde" no dice nada
// sobre la base salvo que alguien haya contado los SKIP. Ver backend/README.md.
func repositorioDePrueba(t *testing.T) (*Repositorio, *usuarios.Repositorio, *db.Pool) {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("sin TEST_DATABASE_URL: se salta la prueba contra Postgres")
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancelar)

	pool, err := db.Abrir(ctx, url)
	if err != nil {
		t.Fatalf("abriendo la base de prueba: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := db.Migrar(ctx, pool); err != nil {
		t.Fatalf("migrando: %v", err)
	}
	// Los pedidos primero: tienen FK hacia usuarios con ON DELETE RESTRICT, asi
	// que borrar usuarios con pedidos vivos falla. Que el orden importe es la
	// prueba de que el RESTRICT esta puesto.
	if _, err := pool.Exec(ctx, `DELETE FROM pedidos`); err != nil {
		t.Fatalf("limpiando pedidos: %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM usuarios`); err != nil {
		t.Fatalf("limpiando usuarios: %v", err)
	}

	return NuevoRepositorio(pool), usuarios.Nuevo(pool), pool
}

// unUsuario crea un cliente con perfil completo y devuelve su id.
func unUsuario(t *testing.T, repo *usuarios.Repositorio, email string) string {
	t.Helper()
	ctx := context.Background()

	u, err := repo.BuscarOCrear(ctx, email)
	if err != nil {
		t.Fatalf("creando usuario %s: %v", email, err)
	}
	if _, err := repo.CompletarAlta(ctx, u.ID, "Ana Perez", "099111222"); err != nil {
		t.Fatalf("completando alta de %s: %v", email, err)
	}
	return u.ID
}

func texto(s string) *string { return &s }

// unPedido arma un Nuevo valido. Cada prueba cambia solo lo que le importa, que
// es lo que hace que se lea que esta probando.
func unPedido(usuarioID, clave string) Nuevo {
	return Nuevo{
		UsuarioID:         usuarioID,
		ClaveIdempotencia: clave,
		RemitenteNombre:   "Ana Perez",
		RemitenteTelefono: "099111222",
		Retiro: Direccion{
			Calle:       "Doctor Martin Berinduague",
			Esquina:     "Vicente Yanez Pinzon",
			Numero:      texto("1234"),
			Apto:        texto("301"),
			Cooperativa: false,
			// La Blanqueada, el mismo punto interior que usa zona-lookup.test.ts.
			Punto: &Punto{Lat: -34.872, Lng: -56.16},
		},
		Entrega: Direccion{
			Calle:   "Rivera",
			Esquina: "Comercio",
			Numero:  texto("4567"),
		},
		PaqueteTamano:        TamanoChico,
		Cantidad:             1,
		RetiroFecha:          "2026-08-13",
		RetiroHora:           "10:30",
		DestinatarioNombre:   "Juan Gomez",
		DestinatarioTelefono: "098765432",
		Precio:               200,
		ZonaID:               1,
	}
}

// FR-011: el pedido se guarda y sobrevive. Y el punto sobrevive el viaje a
// PostGIS, que es lo que mas facil se rompe: ST_MakePoint toma (X, Y) —longitud
// primero—, y si se invierte no da error, da un punto en otro continente.
func TestCrearYReleerConservaTodo(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "ana@example.com")

	creado, nuevo, err := repo.Crear(ctx, unPedido(usuarioID, "clave-1"))
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	if !nuevo {
		t.Fatal("el primer pedido no vino marcado como nuevo")
	}

	leido, err := repo.PorClave(ctx, usuarioID, "clave-1")
	if err != nil {
		t.Fatalf("releyendo: %v", err)
	}

	if leido.Retiro.Punto == nil {
		t.Fatal("el punto de retiro volvio nulo")
	}
	// Tolerancia chica: geography redondea en el viaje de ida y vuelta.
	if dif := leido.Retiro.Punto.Lat - (-34.872); dif > 1e-6 || dif < -1e-6 {
		t.Errorf("latitud: quiero -34.872, dio %v", leido.Retiro.Punto.Lat)
	}
	if dif := leido.Retiro.Punto.Lng - (-56.16); dif > 1e-6 || dif < -1e-6 {
		t.Errorf("longitud: quiero -56.16, dio %v", leido.Retiro.Punto.Lng)
	}

	// La fecha y la hora vuelven COMO SE ESCRIBIERON. Si alguien las hiciera
	// pasar por un time.Time con la zona del proceso —UTC en Railway— este caso
	// se cae con un dia de diferencia.
	if leido.RetiroFecha != "2026-08-13" {
		t.Errorf("fecha de retiro: quiero 2026-08-13, dio %q", leido.RetiroFecha)
	}
	if leido.RetiroHora != "10:30" {
		t.Errorf("hora de retiro: quiero 10:30, dio %q", leido.RetiroHora)
	}

	if leido.Estado != EstadoCreacion {
		t.Errorf("estado inicial: quiero %q, dio %q", EstadoCreacion, leido.Estado)
	}
	if leido.Codigo != creado.Codigo {
		t.Errorf("el codigo cambio entre crear y releer: %q vs %q", creado.Codigo, leido.Codigo)
	}
	if leido.Entrega.Punto != nil {
		t.Error("la entrega volvio con punto, y no debe tener")
	}
	if leido.Precio != 200 || leido.ZonaID != 1 {
		t.Errorf("cobro: quiero 200/zona 1, dio %d/zona %d", leido.Precio, leido.ZonaID)
	}
}

// FR-016 y FR-016a: la misma clave dos veces deja UN pedido, y la segunda
// devuelve el mismo, no un error.
func TestLaMismaClaveDevuelveElMismoPedido(t *testing.T) {
	repo, repoU, pool := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "ana@example.com")

	primero, nuevo1, err := repo.Crear(ctx, unPedido(usuarioID, "misma-clave"))
	if err != nil {
		t.Fatalf("primer intento: %v", err)
	}
	segundo, nuevo2, err := repo.Crear(ctx, unPedido(usuarioID, "misma-clave"))
	if err != nil {
		t.Fatalf("segundo intento: %v", err)
	}

	if !nuevo1 {
		t.Error("el primer intento no vino marcado como nuevo")
	}
	if nuevo2 {
		t.Error("el segundo intento vino marcado como nuevo, y no lo es")
	}
	if primero.ID != segundo.ID {
		t.Errorf("el reintento creo otro pedido: %s vs %s", primero.ID, segundo.ID)
	}

	var cuantos int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM pedidos`).Scan(&cuantos); err != nil {
		t.Fatalf("contando: %v", err)
	}
	if cuantos != 1 {
		t.Errorf("quedaron %d pedidos, quiero 1", cuantos)
	}
}

// SC-005a — EL CONTROL POSITIVO, y la prueba mas importante de este archivo.
//
// Sin ella, "deja un solo pedido" lo satisface una implementacion que deduplica
// por contenido y descarta pedidos buenos. Y el falso positivo ahi no es un
// pedido de menos: es UN PAQUETE QUE NADIE PASA A BUSCAR, descubierto recien
// cuando el cliente reclama.
//
// Dos paquetes iguales a la misma direccion el mismo dia son un caso normal del
// negocio, no una anomalia.
func TestDosPedidosIdenticosConClavesDistintasQuedanLosDos(t *testing.T) {
	repo, repoU, pool := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "ana@example.com")

	// Identicos en TODO menos la clave: mismo remitente, misma direccion, mismo
	// destinatario, misma fecha y hora, mismo precio.
	uno, _, err := repo.Crear(ctx, unPedido(usuarioID, "intento-1"))
	if err != nil {
		t.Fatalf("primer paquete: %v", err)
	}
	dos, nuevo, err := repo.Crear(ctx, unPedido(usuarioID, "intento-2"))
	if err != nil {
		t.Fatalf("segundo paquete: %v", err)
	}

	if !nuevo {
		t.Fatal("el segundo paquete no se creo: la deduplicacion se comio un pedido legitimo")
	}
	if uno.ID == dos.ID {
		t.Fatal("los dos paquetes cayeron en el mismo pedido")
	}
	if uno.Codigo == dos.Codigo {
		t.Errorf("los dos paquetes comparten codigo: %q", uno.Codigo)
	}

	var cuantos int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM pedidos`).Scan(&cuantos); err != nil {
		t.Fatalf("contando: %v", err)
	}
	if cuantos != 2 {
		t.Errorf("quedaron %d pedidos, quiero 2", cuantos)
	}
}

// FR-016: la unicidad de la clave es POR USUARIO. Dos personas distintas pueden
// usar la misma clave sin pisarse — y sin poder sondear si la del otro existe.
func TestLaClaveEsUnicaPorUsuarioYNoGlobalmente(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	ana := unUsuario(t, repoU, "ana@example.com")
	beto := unUsuario(t, repoU, "beto@example.com")

	deAna, _, err := repo.Crear(ctx, unPedido(ana, "clave-compartida"))
	if err != nil {
		t.Fatalf("pedido de Ana: %v", err)
	}
	deBeto, nuevo, err := repo.Crear(ctx, unPedido(beto, "clave-compartida"))
	if err != nil {
		t.Fatalf("pedido de Beto: %v", err)
	}

	if !nuevo {
		t.Fatal("la clave de Ana bloqueo el pedido de Beto: la unicidad quedo global")
	}
	if deAna.ID == deBeto.ID {
		t.Fatal("los pedidos de dos personas distintas cayeron en la misma fila")
	}
}

// FR-017: cada uno ve los suyos. Se prueba en el repositorio ademas de en el
// handler porque es donde la regla se puede imponer de verdad — un handler que
// se olvida es un handler; un repositorio que no acepta pedir los de otro es
// una garantia.
func TestPorUsuarioNoDevuelveLosDeOtro(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	ana := unUsuario(t, repoU, "ana@example.com")
	beto := unUsuario(t, repoU, "beto@example.com")

	if _, _, err := repo.Crear(ctx, unPedido(ana, "a1")); err != nil {
		t.Fatalf("pedido de Ana: %v", err)
	}
	if _, _, err := repo.Crear(ctx, unPedido(ana, "a2")); err != nil {
		t.Fatalf("segundo de Ana: %v", err)
	}
	if _, _, err := repo.Crear(ctx, unPedido(beto, "b1")); err != nil {
		t.Fatalf("pedido de Beto: %v", err)
	}

	deAna, err := repo.PorUsuario(ctx, ana)
	if err != nil {
		t.Fatalf("leyendo los de Ana: %v", err)
	}
	if len(deAna) != 2 {
		t.Fatalf("Ana tiene %d pedidos, quiero 2", len(deAna))
	}
	for _, p := range deAna {
		if p.UsuarioID != ana {
			t.Errorf("entre los de Ana vino un pedido de %s", p.UsuarioID)
		}
	}

	// El control positivo: que Beto tenga el suyo demuestra que la consulta de
	// arriba filtro, y no que simplemente no habia mas pedidos.
	deBeto, err := repo.PorUsuario(ctx, beto)
	if err != nil {
		t.Fatalf("leyendo los de Beto: %v", err)
	}
	if len(deBeto) != 1 {
		t.Fatalf("Beto tiene %d pedidos, quiero 1", len(deBeto))
	}

	todos, err := repo.Todos(ctx)
	if err != nil {
		t.Fatalf("leyendo todos: %v", err)
	}
	if len(todos) != 3 {
		t.Errorf("Todos() devolvio %d, quiero 3", len(todos))
	}
}

// Una lista vacia es una lista vacia, no nil: tiene que serializarse como [] y
// no como null, o cada consumidor se tiene que defender.
func TestSinPedidosDevuelveListaVaciaYNoNil(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	ana := unUsuario(t, repoU, "ana@example.com")

	lista, err := repo.PorUsuario(ctx, ana)
	if err != nil {
		t.Fatalf("leyendo: %v", err)
	}
	if lista == nil {
		t.Fatal("devolvio nil en vez de una lista vacia")
	}
	if len(lista) != 0 {
		t.Errorf("devolvio %d pedidos para alguien sin pedidos", len(lista))
	}
}

// SC-008: el codigo es unico y con formato valido **cruzando FU-9999**.
//
// El UNIQUE de la columna ya garantiza la unicidad; lo que esta prueba cubre es
// lo otro: que el formato NO SE ROMPA al pasar de cuatro digitos. research D4
// afirma que `lpad` no trunca y que el pedido 10.000 sale FU-10000 — eso estaba
// razonado y no comprobado, que es exactamente la clase de afirmacion que
// conviene ejercitar.
//
// Se mueve la secuencia en vez de crear diez mil pedidos: el objeto bajo prueba
// es el DEFAULT de la columna, no el rendimiento del INSERT.
func TestElCodigoSobreviveAlCruzarCuatroDigitos(t *testing.T) {
	repo, repoU, pool := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "ana@example.com")

	formato := regexp.MustCompile(`^FU-\d{4,}$`)
	vistos := map[string]bool{}

	// Arranca justo antes del cruce y lo atraviesa.
	if _, err := pool.Exec(ctx, `SELECT setval('pedidos_codigo_seq', 9998, true)`); err != nil {
		t.Fatalf("moviendo la secuencia: %v", err)
	}

	for i := 0; i < 5; i++ {
		p, _, err := repo.Crear(ctx, unPedido(usuarioID, fmt.Sprintf("cruce-%d", i)))
		if err != nil {
			t.Fatalf("creando el pedido %d del cruce: %v", i, err)
		}
		if !formato.MatchString(p.Codigo) {
			t.Errorf("codigo con formato invalido al cruzar: %q", p.Codigo)
		}
		if vistos[p.Codigo] {
			t.Errorf("codigo repetido: %q", p.Codigo)
		}
		vistos[p.Codigo] = true
	}

	// Los dos casos que importan, nombrados: el ultimo de cuatro digitos y el
	// primero de cinco. Si `lpad` truncara, FU-10000 saldria como FU-0000 o
	// FU-1000 y chocaria con uno viejo.
	for _, quiero := range []string{"FU-9999", "FU-10000"} {
		if !vistos[quiero] {
			t.Errorf("falta el codigo %s entre los emitidos: %v", quiero, claves(vistos))
		}
	}
}

func claves(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// FR-013: el pedido COPIA los datos del perfil, no los referencia.
//
// Es la mitad de SC-007 que hasta ahora solo se verificaba a mano. El defecto
// que cubre aparece recien el dia que un cliente se muda, y para entonces
// reescribiria adonde fue Diego hace seis meses.
func TestCambiarElPerfilNoTocaUnPedidoYaCreado(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "ana@example.com")

	creado, _, err := repo.Crear(ctx, unPedido(usuarioID, "antes-de-mudarse"))
	if err != nil {
		t.Fatalf("creando: %v", err)
	}

	// Se muda y cambia de telefono.
	if _, err := repoU.GuardarPerfil(ctx, usuarioID, "Ana Perez", "091000000",
		&usuarios.Retiro{
			Calle:   "Bulevar Artigas",
			Esquina: "Palmar",
			Numero:  "999",
			Punto:   usuarios.Punto{Lat: -34.9, Lng: -56.2},
		}); err != nil {
		t.Fatalf("actualizando el perfil: %v", err)
	}

	leido, err := repo.PorClave(ctx, usuarioID, "antes-de-mudarse")
	if err != nil {
		t.Fatalf("releyendo el pedido: %v", err)
	}

	if leido.RemitenteTelefono != creado.RemitenteTelefono {
		t.Errorf("el telefono del pedido cambio con el perfil: %q -> %q",
			creado.RemitenteTelefono, leido.RemitenteTelefono)
	}
	if leido.Retiro.Calle != creado.Retiro.Calle {
		t.Errorf("la calle de retiro del pedido cambio con el perfil: %q -> %q",
			creado.Retiro.Calle, leido.Retiro.Calle)
	}
	if leido.Retiro.Punto.Lat != creado.Retiro.Punto.Lat {
		t.Errorf("el punto del pedido cambio con el perfil: %v -> %v",
			creado.Retiro.Punto.Lat, leido.Retiro.Punto.Lat)
	}
}

// PorClave distingue "no hay tal pedido" de "la base fallo". Los dos son un
// error; solo uno es culpa de quien pregunta.
func TestPorClaveInexistenteDaErrNoExiste(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "ana@example.com")

	_, err := repo.PorClave(ctx, usuarioID, "nunca-se-uso")
	if err == nil {
		t.Fatal("una clave inexistente no dio error")
	}
	if err != ErrNoExiste {
		t.Errorf("quiero ErrNoExiste, dio %v", err)
	}
}
