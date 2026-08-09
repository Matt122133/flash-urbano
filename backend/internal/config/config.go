// Package config lee la configuracion del servicio desde el entorno.
//
// Dos reglas gobiernan este paquete. La primera: nada de esto vive en el arbol,
// porque el repo es publico (FR-028). La segunda: si falta una variable
// obligatoria el servicio NO arranca. Es preferible que no levante a que
// levante a medias y falle en la primera request de un cliente real.
//
// Los origenes permitidos y las direcciones administradoras salen de aca y no
// del codigo (FR-023, FR-022), que es lo que hace que mudar el dominio o
// cambiar quien administra sea configuracion y no un despliegue.
package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Valores por defecto de lo que el spec declaro configurable y no constante de
// negocio. Cambiarlos es una variable de entorno, no una recompilacion.
const (
	PuertoPorDefecto = "8080"

	// SesionPorDefecto son las "semanas" de FR-017, tomadas como cuatro.
	SesionPorDefecto = 4 * 7 * 24 * time.Hour

	// RastroPorDefecto son los noventa dias de FR-022c.
	RastroPorDefecto = 90 * 24 * time.Hour
)

// Config es la configuracion completa del servicio, ya validada.
type Config struct {
	Puerto      string
	DatabaseURL string

	// OrigenesPermitidos son los unicos origenes que el servicio acepta
	// (FR-023, FR-025). Nunca vacio: Cargar falla antes.
	OrigenesPermitidos []string

	// GoogleClientID es publico por diseno —tambien viaja al navegador— pero
	// el servicio lo necesita para validar el destinatario del token (FR-007).
	GoogleClientID string

	CorreoAPIKey    string
	CorreoRemitente string

	// AdminEmails son las direcciones administradoras, normalizadas a
	// minusculas (FR-022). No hay columna de admin en la base a proposito.
	AdminEmails []string

	SesionDuracion  time.Duration
	RastroRetencion time.Duration
}

// EsAdmin dice si una direccion es administradora.
//
// Vive aca y no en el paquete de usuarios para que la comparacion use la misma
// normalizacion con la que se cargo la lista. Separar las dos cosas es como se
// cuela un bug de mayusculas que deja a Diego afuera de su propio panel.
func (c *Config) EsAdmin(email string) bool {
	email = normalizarEmail(email)
	if email == "" {
		return false
	}
	for _, admin := range c.AdminEmails {
		if admin == email {
			return true
		}
	}
	return false
}

// Cargar arma la configuracion desde el entorno.
//
// Reporta TODAS las variables que faltan de una vez, no la primera. Arrancar el
// servicio seis veces para descubrir seis variables es una perdida de tiempo
// evitable, y en un despliegue remoto cada intento cuesta minutos.
func Cargar() (*Config, error) {
	var faltantes []string

	obligatoria := func(nombre string) string {
		valor := strings.TrimSpace(os.Getenv(nombre))
		if valor == "" {
			faltantes = append(faltantes, nombre)
		}
		return valor
	}

	cfg := &Config{
		Puerto:          valorODefecto("PORT", PuertoPorDefecto),
		DatabaseURL:     obligatoria("DATABASE_URL"),
		GoogleClientID:  obligatoria("GOOGLE_CLIENT_ID"),
		CorreoAPIKey:    obligatoria("CORREO_API_KEY"),
		CorreoRemitente: obligatoria("CORREO_REMITENTE"),
	}

	// Las listas se validan por su contenido parseado, no por el texto crudo:
	// CORS_ORIGENES="," esta definida y no aporta ningun origen.
	cfg.OrigenesPermitidos = separarPorComas(obligatoria("CORS_ORIGENES"), false)
	if len(cfg.OrigenesPermitidos) == 0 && !yaFalta(faltantes, "CORS_ORIGENES") {
		faltantes = append(faltantes, "CORS_ORIGENES")
	}

	cfg.AdminEmails = separarPorComas(obligatoria("ADMIN_EMAILS"), true)
	if len(cfg.AdminEmails) == 0 && !yaFalta(faltantes, "ADMIN_EMAILS") {
		faltantes = append(faltantes, "ADMIN_EMAILS")
	}

	if len(faltantes) > 0 {
		return nil, fmt.Errorf(
			"faltan variables de entorno obligatorias: %s", strings.Join(faltantes, ", "))
	}

	var err error
	if cfg.SesionDuracion, err = duracionODefecto("SESION_DURACION", SesionPorDefecto); err != nil {
		return nil, err
	}
	if cfg.RastroRetencion, err = duracionODefecto("RASTRO_RETENCION", RastroPorDefecto); err != nil {
		return nil, err
	}

	return cfg, nil
}

func valorODefecto(nombre, porDefecto string) string {
	if valor := strings.TrimSpace(os.Getenv(nombre)); valor != "" {
		return valor
	}
	return porDefecto
}

// duracionODefecto parsea una duracion del entorno.
//
// Una duracion mal escrita es un error de arranque y no un silencioso volver al
// default: "SESION_DURACION=4w" no es valido en Go, y tomarlo como cuatro
// semanas por defecto haria que el operador crea que configuro algo que no
// configuro. Una duracion negativa o cero deja sesiones nacidas vencidas.
func duracionODefecto(nombre string, porDefecto time.Duration) (time.Duration, error) {
	crudo := strings.TrimSpace(os.Getenv(nombre))
	if crudo == "" {
		return porDefecto, nil
	}
	d, err := time.ParseDuration(crudo)
	if err != nil {
		return 0, fmt.Errorf("%s no es una duracion valida (ej: 672h): %w", nombre, err)
	}
	if d <= 0 {
		return 0, fmt.Errorf("%s tiene que ser mayor a cero, es %s", nombre, d)
	}
	return d, nil
}

func separarPorComas(crudo string, comoEmail bool) []string {
	var salida []string
	for _, parte := range strings.Split(crudo, ",") {
		parte = strings.TrimSpace(parte)
		if comoEmail {
			parte = normalizarEmail(parte)
		}
		if parte != "" {
			salida = append(salida, parte)
		}
	}
	return salida
}

// normalizarEmail deja una direccion en la forma canonica con la que se guarda
// y se compara en todo el servicio: sin espacios y en minusculas.
//
// Es la misma normalizacion que implementa FR-007a —una direccion, un usuario—
// y por eso vive en un solo lugar.
func normalizarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func yaFalta(faltantes []string, nombre string) bool {
	for _, f := range faltantes {
		if f == nombre {
			return true
		}
	}
	return false
}
