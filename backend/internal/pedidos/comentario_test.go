package pedidos

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// Las pruebas del comentario del pedido (026).
//
// **Las de validacion no necesitan Postgres y por eso estan primero.** En este
// repo las pruebas contra la base se saltan solas sin `TEST_DATABASE_URL`, asi
// que todo lo que pueda probarse sin ella corre siempre — incluida en la
// maquina de alguien que todavia no levanto Docker.

// unaPeticion arma un cuerpo valido. La fecha es futura a proposito:
// `validarRetiro` rechaza el pasado, y una fecha fija se vence sola.
func unaPeticion(comentario string) peticionCrear {
	manana := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	return peticionCrear{
		Remitente: persona{Nombre: "Ana Perez", Telefono: "099111222"},
		Retiro: direccionConPunto{
			Calle:   "Doctor Martin Berinduague",
			Esquina: "Vicente Yanez Pinzon",
			Punto:   &Punto{Lat: -34.872, Lng: -56.16},
		},
		Entrega: direccionConPunto{
			Calle:   "Rivera",
			Esquina: "Comercio",
			Punto:   &Punto{Lat: -34.872, Lng: -56.16},
		},
		Paquete:      paquete{Tamano: TamanoChico, Cantidad: 1},
		RetiroCuando: cuando{Fecha: manana, Hora: "10:30"},
		Destinatario: persona{Nombre: "Juan Gomez", Telefono: "098765432"},
		Cobro:        cobro{ZonaID: 1, Precio: 200},
		Comentario:   comentario,
	}
}

func handlersDePrueba() *Handlers { return &Handlers{ahora: time.Now} }

// FR-002: el campo es opcional. Un cuerpo sin la clave se acepta igual, que es
// lo que hace que la web vieja siga creando pedidos contra el servicio nuevo.
func TestUnPedidoSinComentarioSeCreaIgual(t *testing.T) {
	n, motivo := handlersDePrueba().aNuevo("u1", "k1", unaPeticion(""))
	if motivo != "" {
		t.Fatalf("un pedido sin comentario tendria que ser valido, y dio: %q", motivo)
	}
	if n.Comentario != nil {
		t.Fatalf("sin comentario tendria que quedar nil, y quedo %q", *n.Comentario)
	}
}

// FR-004: solo espacios cuenta como ausencia.
//
// **Es la prueba que evita el hueco vacio de FR-009.** Si esto guardara `""`,
// cada pantalla decidiria por su cuenta si lo dibuja, y alguna dibujaria una
// etiqueta con nada al lado.
func TestUnComentarioDeSoloEspaciosEsNinguno(t *testing.T) {
	for _, blanco := range []string{"   ", "\n", "\t\t", " \n \r\n  "} {
		n, motivo := handlersDePrueba().aNuevo("u1", "k1", unaPeticion(blanco))
		if motivo != "" {
			t.Fatalf("%q tendria que ser valido, y dio: %q", blanco, motivo)
		}
		if n.Comentario != nil {
			t.Errorf("%q tendria que quedar en nil, y quedo %q", blanco, *n.Comentario)
		}
	}
}

// FR-005: los saltos de linea de ADENTRO se conservan; los de los extremos no.
//
// Aplanar el texto es el defecto clasico de un campo multilinea, y no lo ve
// ningun tipo ni ningun compilador: el `string` es el mismo.
func TestElComentarioConservaLosSaltosDeAdentro(t *testing.T) {
	tres := "Llamar antes\nPreguntar por la encargada\nRetirar por atras"
	n, motivo := handlersDePrueba().aNuevo("u1", "k1", unaPeticion("  \n"+tres+"  \n"))
	if motivo != "" {
		t.Fatalf("tendria que ser valido, y dio: %q", motivo)
	}
	if n.Comentario == nil {
		t.Fatal("tendria que haber comentario")
	}
	if *n.Comentario != tres {
		t.Fatalf("se esperaba %q y quedo %q", tres, *n.Comentario)
	}
	if strings.Count(*n.Comentario, "\n") != 2 {
		t.Fatalf("tendria que conservar los dos saltos de adentro: %q", *n.Comentario)
	}
}

// FR-003: el tope se aplica, y el borde exacto entra.
func TestElComentarioTopeaEn280(t *testing.T) {
	justo := strings.Repeat("a", ComentarioLargoMaximo)
	if _, motivo := handlersDePrueba().aNuevo("u1", "k1", unaPeticion(justo)); motivo != "" {
		t.Fatalf("%d caracteres tendrian que entrar, y dio: %q", ComentarioLargoMaximo, motivo)
	}

	pasado := strings.Repeat("a", ComentarioLargoMaximo+1)
	if _, motivo := handlersDePrueba().aNuevo("u1", "k1", unaPeticion(pasado)); motivo == "" {
		t.Fatalf("%d caracteres tendrian que rechazarse", ComentarioLargoMaximo+1)
	}
}

// **El tope cuenta CARACTERES, no bytes**, igual que el `char_length` de la
// migracion `0009`.
//
// Esta prueba es la que falla si alguien cambia `utf8.RuneCountInString` por
// `len()`: 280 caracteres con enes y tildes ocupan mas de 280 bytes, asi que
// con `len()` esto se rechazaria — y el contador del navegador, que cuenta
// caracteres, mostraria un numero distinto del que el servicio aplica.
func TestElTopeDelComentarioCuentaCaracteresYNoBytes(t *testing.T) {
	conEnes := strings.Repeat("ñ", ComentarioLargoMaximo)
	if len(conEnes) <= ComentarioLargoMaximo {
		t.Fatalf("la prueba no sirve si el texto no ocupa mas bytes que caracteres: %d", len(conEnes))
	}
	if _, motivo := handlersDePrueba().aNuevo("u1", "k1", unaPeticion(conEnes)); motivo != "" {
		t.Fatalf("280 caracteres con enes tendrian que entrar, y dio: %q", motivo)
	}
}

// Contrato 1.3: sin comentario **la clave desaparece**, no llega `null`.
//
// Es la forma que el cliente Kotlin ya sabe leer, la misma que usa
// `Direccion.punto`. Si esto empezara a mandar `null`, la app se encontraria
// una tercera forma que nadie pidio.
func TestSinComentarioLaClaveNoSaleEnElJSON(t *testing.T) {
	crudo, err := json.Marshal(Pedido{Codigo: "FU-0001"})
	if err != nil {
		t.Fatalf("serializando: %v", err)
	}
	if strings.Contains(string(crudo), "comentario") {
		t.Fatalf("un pedido sin comentario no tendria que traer la clave: %s", crudo)
	}

	texto := "Tocar timbre del 2"
	crudo, err = json.Marshal(Pedido{Codigo: "FU-0001", Comentario: &texto})
	if err != nil {
		t.Fatalf("serializando: %v", err)
	}
	if !strings.Contains(string(crudo), `"comentario":"Tocar timbre del 2"`) {
		t.Fatalf("con comentario tendria que salir el texto: %s", crudo)
	}
}

// De aca para abajo, contra Postgres de verdad.

// FR-005 y FR-006: el texto sobrevive el viaje a la base y vuelve igual,
// renglones incluidos.
func TestElComentarioSobreviveLaBase(t *testing.T) {
	repo, usuariosRepo, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, usuariosRepo, "ana@example.com")

	tres := "Llamar antes: \"el porton esta trabado\"\nPreguntar por la encargada\nRetirar por atras"
	n := unPedido(usuarioID, "k-comentario")
	n.Comentario = &tres

	p, nuevo, err := repo.Crear(ctx, n)
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	if !nuevo {
		t.Fatal("tendria que ser nuevo")
	}
	if p.Comentario == nil {
		t.Fatal("el pedido tendria que traer el comentario")
	}
	if *p.Comentario != tres {
		t.Fatalf("se esperaba %q y volvio %q", tres, *p.Comentario)
	}
}

// FR-010: un pedido sin comentario se lee sin romperse y queda en nil.
//
// Es el caso de TODOS los pedidos anteriores a este feature, que son los que
// hay en produccion.
func TestUnPedidoSinComentarioSeLeeIgual(t *testing.T) {
	repo, usuariosRepo, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, usuariosRepo, "ana@example.com")

	p, _, err := repo.Crear(ctx, unPedido(usuarioID, "k-sin"))
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	if p.Comentario != nil {
		t.Fatalf("tendria que quedar nil, y quedo %q", *p.Comentario)
	}
}

// FR-007 y contrato 1.2: se edita y se borra, mientras el pedido este pendiente.
func TestSePuedeEditarYBorrarElComentario(t *testing.T) {
	repo, usuariosRepo, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, usuariosRepo, "ana@example.com")

	viejo := "Tocar timbre del 2"
	n := unPedido(usuarioID, "k-editar")
	n.Comentario = &viejo
	p, _, err := repo.Crear(ctx, n)
	if err != nil {
		t.Fatalf("creando: %v", err)
	}

	nuevoTexto := "El porton de adelante no abre, usar el de atras"
	edicion := unPedido(usuarioID, "")
	edicion.Comentario = &nuevoTexto
	editado, err := repo.Editar(ctx, p.ID, usuarioID, edicion)
	if err != nil {
		t.Fatalf("editando: %v", err)
	}
	if editado.Comentario == nil || *editado.Comentario != nuevoTexto {
		t.Fatalf("tendria que quedar el texto nuevo, y quedo %v", editado.Comentario)
	}

	// Borrarlo entero: el pedido vuelve a ser uno sin comentario, indistinguible
	// de los que nunca tuvieron.
	sinNada := unPedido(usuarioID, "")
	sinNada.Comentario = nil
	borrado, err := repo.Editar(ctx, p.ID, usuarioID, sinNada)
	if err != nil {
		t.Fatalf("borrando el comentario: %v", err)
	}
	if borrado.Comentario != nil {
		t.Fatalf("tendria que quedar sin comentario, y quedo %q", *borrado.Comentario)
	}
}

// FR-003, la ultima red: el CHECK de la migracion `0009`.
//
// El servicio ya rechaza antes de llegar aca, asi que esto **no prueba el
// camino normal**: prueba que la base sostenga el tope para cualquier otro
// camino de escritura, incluido un `psql` a mano.
func TestLaBaseRechazaUnComentarioDemasiadoLargo(t *testing.T) {
	repo, usuariosRepo, _ := repositorioDePrueba(t)
	ctx := context.Background()
	usuarioID := unUsuario(t, usuariosRepo, "ana@example.com")

	pasado := strings.Repeat("a", ComentarioLargoMaximo+1)
	n := unPedido(usuarioID, "k-largo")
	n.Comentario = &pasado

	if _, _, err := repo.Crear(ctx, n); err == nil {
		t.Fatal("la base tendria que rechazar un comentario de mas de 280")
	}
}
