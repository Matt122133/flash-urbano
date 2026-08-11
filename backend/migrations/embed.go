// Package migrations lleva el SQL versionado adentro del binario.
//
// Existe como paquete —y no como un embed desde internal/db— por una
// limitacion de go:embed: solo puede incluir archivos de su propio directorio
// hacia abajo. Manteniendo migrations/ en la raiz del modulo, como lo pide la
// estructura del plan, el embed tiene que vivir aca.
//
// Incluir el SQL en el binario es lo que hace que desplegar y migrar sean el
// mismo acto (research D7): en Railway no hay nadie para copiar archivos.
package migrations

import "embed"

// FS son las migraciones, ordenadas por nombre de archivo.
//
// Los numeros van con ancho fijo (0001, 0002...) porque el orden lexicografico
// ES el orden de aplicacion: sin rellenar, "10" vendria antes que "2".
//
//go:embed *.sql
var FS embed.FS
