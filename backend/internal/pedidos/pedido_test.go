package pedidos

import (
	"context"
	"errors"
	"fmt"
	"os"
	"regexp"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

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
	// **`pedidos_estados` PRIMERO, y por lo mismo que los pedidos van antes que
	// los usuarios**: su FK hacia `pedidos` es ON DELETE RESTRICT, asi que
	// borrar un pedido con historial falla. Que el orden importe es la prueba
	// de que el RESTRICT esta puesto (012, migracion 0005).
	if _, err := pool.Exec(ctx, `DELETE FROM pedidos_estados`); err != nil {
		t.Fatalf("limpiando el historial de estados: %v", err)
	}
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
			// **El punto que decide zona y precio desde 011.** El del retiro
			// quedo arriba y ya no cobra: se guarda para la ruta, y puede
			// faltar. Este no.
			Punto: &Punto{Lat: -34.872, Lng: -56.16},
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
// Un pedido ANTERIOR a `011`, o sea sin punto de entrega, se lee sin romperse.
//
// **Esta prueba existe porque su ausencia tumbo produccion el 2026-08-23.** La
// migracion entro `entrega_punto` como `NOT NULL` apoyandose en que produccion
// estaba vacia; no lo estaba, el servicio no arranco, y al volver la columna
// nullable aparecio el defecto de al lado: el lector escaneaba ese punto en un
// `float64` pelado y habria roto la lectura de esos mismos pedidos.
//
// Se produce el caso como se produce en la realidad —una fila que ya existia
// antes de la columna— vaciando el punto de una creada normalmente.
func TestUnPedidoSinPuntoDeEntregaSeLeeIgual(t *testing.T) {
	repo, repoU, pool := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "vieja@example.com")

	creado, _, err := repo.Crear(ctx, unPedido(usuarioID, "clave-vieja"))
	if err != nil {
		t.Fatalf("creando: %v", err)
	}

	if _, err := pool.Exec(ctx,
		`UPDATE pedidos SET entrega_punto = NULL WHERE id = $1`, creado.ID); err != nil {
		t.Fatalf("vaciando el punto de entrega: %v", err)
	}

	lista, err := repo.PorUsuario(ctx, usuarioID)
	if err != nil {
		t.Fatalf("releyendo un pedido sin punto de entrega: %v", err)
	}
	if len(lista) != 1 {
		t.Fatalf("quiero 1 pedido, hay %d", len(lista))
	}
	if lista[0].Entrega.Punto != nil {
		t.Error("la entrega volvio con punto, y se lo vaciamos")
	}
	// Control positivo: el resto del pedido llega entero. Sin esto, un lector
	// que devolviera un pedido vacio pasaria la prueba igual.
	if lista[0].Codigo != creado.Codigo || lista[0].Precio != creado.Precio {
		t.Errorf("el pedido volvio distinto: %+v", lista[0])
	}
}

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
	// Invertido en 011: la entrega es la que SIEMPRE tiene punto, porque es la
	// que cobra. Antes la afirmacion era la contraria.
	if leido.Entrega.Punto == nil {
		t.Fatal("la entrega volvio sin punto, y es el que decide el precio")
	}
	if dif := leido.Entrega.Punto.Lng - (-56.16); dif > 1e-6 || dif < -1e-6 {
		t.Errorf("longitud de la entrega: quiero -56.16, dio %v", leido.Entrega.Punto.Lng)
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

// FR-001, FR-002, FR-008 de `021`. El orden de la lista de administracion.
//
// **Las fechas de retiro van ASCENDENTES a proposito**, y ahi esta todo el
// valor de la prueba. El criterio viejo era `retiro_fecha DESC`: con fechas
// ascendentes devuelve la secuencia INVERTIDA y la prueba falla, que es lo que
// se quiere.
//
// **Se escribio al reves la primera vez y paso en verde con el SQL viejo.** Con
// fechas descendentes, `retiro_fecha DESC` reproduce el orden de creacion por
// casualidad, y la prueba parecia comprobar el orden nuevo sin comprobar nada.
// Es el motivo por el que hay que verla en rojo ANTES de cambiar la consulta;
// una prueba de orden que nunca fallo no se sabe si mira el orden.
func TestTodosVieneDelMasViejoAlMasNuevo(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "orden@example.com")

	// Se crean en este orden y con la fecha de retiro al reves.
	casos := []struct {
		clave  string
		retiro string
	}{
		{"primero", "2026-01-02"},
		{"segundo", "2026-06-15"},
		{"tercero", "2026-12-31"},
	}

	creados := make([]string, 0, len(casos))
	for _, c := range casos {
		n := unPedido(usuarioID, c.clave)
		n.RetiroFecha = c.retiro
		p, _, err := repo.Crear(ctx, n)
		if err != nil {
			t.Fatalf("creando %s: %v", c.clave, err)
		}
		creados = append(creados, p.Codigo)
	}

	todos, err := repo.Todos(ctx)
	if err != nil {
		t.Fatalf("leyendo todos: %v", err)
	}
	if len(todos) != len(casos) {
		t.Fatalf("Todos() devolvio %d, quiero %d", len(todos), len(casos))
	}

	for i, p := range todos {
		if p.Codigo != creados[i] {
			var vinieron []string
			for _, q := range todos {
				vinieron = append(vinieron, q.Codigo)
			}
			t.Fatalf(
				"Todos() no vino por fecha de creacion ascendente:\n  vino:   %v\n  quiero: %v",
				vinieron, creados,
			)
		}
	}
}

// FR-003 de `021`: el orden es total y determinista.
//
// Importa mas de lo que parece. Hasta este feature el segundo criterio era
// `retiro_hora`, que desde `014` vale `"16:00"` en TODOS los pedidos: dentro de
// un mismo dia de retiro no habia desempate, y dos llamadas podian devolver
// secuencias distintas sin que nadie tocara nada.
func TestTodosDevuelveSiempreLaMismaSecuencia(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "estable@example.com")

	// Todos con la MISMA fecha de retiro: sin desempate real, es donde el orden
	// indefinido se manifestaba.
	for _, clave := range []string{"a", "b", "c", "d", "e"} {
		n := unPedido(usuarioID, clave)
		n.RetiroFecha = "2026-09-08"
		if _, _, err := repo.Crear(ctx, n); err != nil {
			t.Fatalf("creando %s: %v", clave, err)
		}
	}

	primera, err := repo.Todos(ctx)
	if err != nil {
		t.Fatalf("primera lectura: %v", err)
	}

	for intento := 0; intento < 5; intento++ {
		otra, err := repo.Todos(ctx)
		if err != nil {
			t.Fatalf("lectura %d: %v", intento, err)
		}
		for i := range primera {
			if otra[i].Codigo != primera[i].Codigo {
				t.Fatalf(
					"el orden cambio entre llamadas en la posicion %d: %s vs %s",
					i, primera[i].Codigo, otra[i].Codigo,
				)
			}
		}
	}
}

// FR-004 de `021`: el historial del cliente NO se mueve.
//
// `PorUsuario()` vive a diez lineas de `Todos()` en el mismo archivo, y ese es
// exactamente el riesgo que esta prueba cubre: que invertir el orden de la lista
// de administracion se arrastre a la pantalla del cliente, que nadie pidio
// tocar. *Mis pedidos* es un historial personal —lo ultimo primero—, no una cola
// de trabajo.
func TestPorUsuarioSigueDelMasNuevoAlMasViejo(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, "historial@example.com")

	creados := make([]string, 0, 3)
	for _, clave := range []string{"uno", "dos", "tres"} {
		p, _, err := repo.Crear(ctx, unPedido(usuarioID, clave))
		if err != nil {
			t.Fatalf("creando %s: %v", clave, err)
		}
		creados = append(creados, p.Codigo)
	}

	mios, err := repo.PorUsuario(ctx, usuarioID)
	if err != nil {
		t.Fatalf("leyendo los propios: %v", err)
	}
	if len(mios) != len(creados) {
		t.Fatalf("PorUsuario() devolvio %d, quiero %d", len(mios), len(creados))
	}

	// Al reves que Todos(): el ultimo creado va primero.
	for i, p := range mios {
		esperado := creados[len(creados)-1-i]
		if p.Codigo != esperado {
			t.Fatalf(
				"PorUsuario() en la posicion %d devolvio %s, quiero %s "+
					"(el historial del cliente va del mas nuevo al mas viejo)",
				i, p.Codigo, esperado,
			)
		}
	}
}

// --- `022`: editar y dar de baja, mientras nadie lo tomo --------------------
//
// Lo que se prueba aca son sobre todo PROHIBICIONES: no editar lo ajeno, no
// editar lo tomado, no ganar la carrera contra Diego. Cada una viene con su
// control positivo —el caso que SI funciona— porque una prohibicion sola queda
// verde tambien cuando deja de mirar donde cree.

// unPedidoEnLaBase crea un pedido por el repositorio y devuelve el pedido y su
// usuario. **No confundir con `unPedidoCreado` de handlers_test.go**, que hace
// lo mismo por HTTP: son dos capas distintas y conviene que se note en el
// nombre.
func unPedidoEnLaBase(t *testing.T, repo *Repositorio, repoU *usuarios.Repositorio, email, clave string) (*Pedido, string) {
	t.Helper()
	ctx := context.Background()
	usuarioID := unUsuario(t, repoU, email)
	p, _, err := repo.Crear(ctx, unPedido(usuarioID, clave))
	if err != nil {
		t.Fatalf("creando el pedido de %s: %v", email, err)
	}
	return p, usuarioID
}

// FR-001, FR-005, FR-005a: se edita, se guarda entero, y el codigo no cambia.
func TestEditarUnPedidoPendientePropio(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	p, usuarioID := unPedidoEnLaBase(t, repo, repoU, "edita@example.com", "k1")

	cambios := unPedido(usuarioID, "k1")
	cambios.DestinatarioNombre = "Otro Destinatario"
	cambios.DestinatarioTelefono = "099000111"
	cambios.Cantidad = 7

	editado, err := repo.Editar(ctx, p.ID, usuarioID, cambios)
	if err != nil {
		t.Fatalf("editando: %v", err)
	}

	if editado.DestinatarioNombre != "Otro Destinatario" {
		t.Errorf("el destinatario quedo en %q", editado.DestinatarioNombre)
	}
	if editado.Cantidad != 7 {
		t.Errorf("la cantidad quedo en %d, quiero 7", editado.Cantidad)
	}
	// **FR-005**: es el codigo que la persona anoto y el que puede estar impreso
	// en una etiqueta de `020`. Si cambiara, la etiqueta pegada a la caja
	// dejaria de corresponder al pedido.
	if editado.Codigo != p.Codigo {
		t.Errorf("el codigo cambio de %s a %s", p.Codigo, editado.Codigo)
	}
	if editado.ID != p.ID {
		t.Errorf("el id cambio: no es una edicion, es un pedido nuevo")
	}
}

// FR-004: un pedido ajeno es inalcanzable, y no se distingue de uno inexistente.
func TestNoSePuedeEditarNiEliminarUnPedidoAjeno(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	p, _ := unPedidoEnLaBase(t, repo, repoU, "duenio@example.com", "k1")
	otro := unUsuario(t, repoU, "ajeno@example.com")

	if _, err := repo.Editar(ctx, p.ID, otro, unPedido(otro, "k2")); !errors.Is(err, ErrFueraDeVentana) {
		t.Errorf("editar ajeno devolvio %v, quiero ErrFueraDeVentana", err)
	}
	if err := repo.Eliminar(ctx, p.ID, otro); !errors.Is(err, ErrFueraDeVentana) {
		t.Errorf("eliminar ajeno devolvio %v, quiero ErrFueraDeVentana", err)
	}

	// **El control positivo**: el pedido sigue ahi y sin tocar. Sin esto, un
	// Editar que no hiciera nunca nada pasaria los dos casos de arriba.
	sigue, err := repo.porID(ctx, p.ID)
	if err != nil {
		t.Fatalf("releyendo el pedido: %v", err)
	}
	if sigue.DestinatarioNombre != p.DestinatarioNombre {
		t.Errorf("el pedido ajeno fue modificado")
	}
}

// FR-003 y FR-012: la ventana se cierra cuando Diego toma el pedido, **y la
// carrera la decide la base**.
//
// Es el caso real: el cliente abre Editar, Diego toma el pedido en ese momento,
// y el guardado llega tarde. Si la comprobacion viviera en un SELECT previo o
// en la pantalla, este guardado pisaria un trabajo en curso.
func TestUnPedidoTomadoYaNoSeEditaNiSeElimina(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	p, usuarioID := unPedidoEnLaBase(t, repo, repoU, "carrera@example.com", "k1")

	// **El control positivo, y va ANTES a proposito**: mientras esta pendiente
	// las dos operaciones funcionan. Sin esto, los casos de abajo pasarian
	// aunque Editar y Eliminar no hicieran nada nunca.
	if _, err := repo.Editar(ctx, p.ID, usuarioID, unPedido(usuarioID, "k1")); err != nil {
		t.Fatalf("editando mientras esta pendiente: %v", err)
	}

	// Diego lo toma.
	if _, err := repo.CambiarEstado(ctx, p.ID, EstadoAceptacion, nil); err != nil {
		t.Fatalf("tomando el pedido: %v", err)
	}

	if _, err := repo.Editar(ctx, p.ID, usuarioID, unPedido(usuarioID, "k1")); !errors.Is(err, ErrFueraDeVentana) {
		t.Errorf("editar un pedido tomado devolvio %v, quiero ErrFueraDeVentana", err)
	}
	if err := repo.Eliminar(ctx, p.ID, usuarioID); !errors.Is(err, ErrFueraDeVentana) {
		t.Errorf("eliminar un pedido tomado devolvio %v, quiero ErrFueraDeVentana", err)
	}

	// Y sigue existiendo: el DELETE no borro nada.
	if _, err := repo.porID(ctx, p.ID); err != nil {
		t.Errorf("el pedido tomado desaparecio: %v", err)
	}
}

// FR-002 y FR-008: la baja borra la fila y el pedido se va de las DOS listas.
func TestEliminarSacaElPedidoDeLasDosListas(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	p, usuarioID := unPedidoEnLaBase(t, repo, repoU, "baja@example.com", "k1")

	// Control positivo: antes de la baja esta en las dos.
	if mios, _ := repo.PorUsuario(ctx, usuarioID); len(mios) != 1 {
		t.Fatalf("antes de la baja PorUsuario devolvio %d, quiero 1", len(mios))
	}
	if todos, _ := repo.Todos(ctx); len(todos) != 1 {
		t.Fatalf("antes de la baja Todos devolvio %d, quiero 1", len(todos))
	}

	if err := repo.Eliminar(ctx, p.ID, usuarioID); err != nil {
		t.Fatalf("dando de baja: %v", err)
	}

	if mios, _ := repo.PorUsuario(ctx, usuarioID); len(mios) != 0 {
		t.Errorf("sigue en Mis pedidos: %d", len(mios))
	}
	if todos, _ := repo.Todos(ctx); len(todos) != 0 {
		t.Errorf("sigue en la lista de Diego: %d", len(todos))
	}
	// **Y la fila no esta: la baja BORRA, no marca.** Es la diferencia entre
	// este feature y uno con estado `anulado`, y lo que evita tocar la app.
	//
	// Se compara contra pgx.ErrNoRows y no contra ErrNoExiste: `porID` devuelve
	// el error crudo del driver —el que traduce es `PorClave`—, y afirmar sobre
	// el error equivocado dejaria pasar el caso en que la fila sigue ahi.
	if _, err := repo.porID(ctx, p.ID); !errors.Is(err, pgx.ErrNoRows) {
		t.Errorf("la fila no se borro, o fallo por otro motivo: %v", err)
	}
}

// Dar de baja dos veces: la segunda no encuentra nada, y no es un error que
// haya que gritar. Se comprueba que devuelva el mismo "no" de siempre.
func TestEliminarDosVecesNoEsUnCasoEspecial(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	p, usuarioID := unPedidoEnLaBase(t, repo, repoU, "dosveces@example.com", "k1")

	if err := repo.Eliminar(ctx, p.ID, usuarioID); err != nil {
		t.Fatalf("primera baja: %v", err)
	}
	if err := repo.Eliminar(ctx, p.ID, usuarioID); !errors.Is(err, ErrFueraDeVentana) {
		t.Errorf("segunda baja devolvio %v, quiero ErrFueraDeVentana", err)
	}
}
