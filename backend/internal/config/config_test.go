package config

import (
	"strings"
	"testing"
	"time"
)

// entornoCompleto deja el entorno con todas las obligatorias puestas. Cada
// prueba parte de aca y rompe una sola cosa, para que el fallo diga que se
// rompio y no cual de seis variables faltaba.
func entornoCompleto(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://usuario:clave@localhost:5432/flash")
	t.Setenv("CORS_ORIGENES", "https://matt122133.github.io")
	t.Setenv("GOOGLE_CLIENT_ID", "1234.apps.googleusercontent.com")
	t.Setenv("CORREO_API_KEY", "no-es-una-clave-real")
	t.Setenv("CORREO_REMITENTE", "hola@send.flashurbano.uy")
	t.Setenv("ADMIN_EMAILS", "diego@example.com")
	t.Setenv("PORT", "")
	t.Setenv("SESION_DURACION", "")
	t.Setenv("RASTRO_RETENCION", "")
}

func TestCargarConEntornoCompleto(t *testing.T) {
	entornoCompleto(t)

	cfg, err := Cargar()
	if err != nil {
		t.Fatalf("no esperaba error, dio: %v", err)
	}
	if cfg.Puerto != PuertoPorDefecto {
		t.Errorf("puerto: quiero %q, dio %q", PuertoPorDefecto, cfg.Puerto)
	}
	if cfg.SesionDuracion != SesionPorDefecto {
		t.Errorf("sesion: quiero %s (cuatro semanas, FR-017), dio %s",
			SesionPorDefecto, cfg.SesionDuracion)
	}
	if cfg.RastroRetencion != RastroPorDefecto {
		t.Errorf("rastro: quiero %s (noventa dias, FR-022c), dio %s",
			RastroPorDefecto, cfg.RastroRetencion)
	}
}

// Los defaults son los que el spec declaro como valores asumidos, no como
// constantes de negocio. Si alguien los cambia sin querer, esta prueba lo dice.
func TestDefaultsSonLosDelSpec(t *testing.T) {
	if SesionPorDefecto != 672*time.Hour {
		t.Errorf("cuatro semanas son 672h, la constante dice %s", SesionPorDefecto)
	}
	if RastroPorDefecto != 2160*time.Hour {
		t.Errorf("noventa dias son 2160h, la constante dice %s", RastroPorDefecto)
	}
}

// FR-028: el servicio no arranca si falta una obligatoria. Es la prueba que
// distingue "no levanta" de "levanta y falla contra un cliente real".
func TestFaltaUnaObligatoria(t *testing.T) {
	obligatorias := []string{
		"DATABASE_URL",
		"CORS_ORIGENES",
		"GOOGLE_CLIENT_ID",
		"CORREO_API_KEY",
		"CORREO_REMITENTE",
		"ADMIN_EMAILS",
	}

	for _, nombre := range obligatorias {
		t.Run(nombre, func(t *testing.T) {
			entornoCompleto(t)
			t.Setenv(nombre, "")

			_, err := Cargar()
			if err == nil {
				t.Fatalf("sin %s tendria que fallar, arranco igual", nombre)
			}
			if !strings.Contains(err.Error(), nombre) {
				t.Errorf("el error tiene que nombrar %s, dice: %v", nombre, err)
			}
		})
	}
}

// Reportar de a una obliga a reintentar el arranque una vez por variable, que
// en un despliegue remoto son minutos por vuelta.
func TestReportaTodasLasQueFaltan(t *testing.T) {
	entornoCompleto(t)
	t.Setenv("DATABASE_URL", "")
	t.Setenv("CORREO_API_KEY", "")

	_, err := Cargar()
	if err == nil {
		t.Fatal("esperaba error")
	}
	for _, nombre := range []string{"DATABASE_URL", "CORREO_API_KEY"} {
		if !strings.Contains(err.Error(), nombre) {
			t.Errorf("el error tiene que nombrar %s, dice: %v", nombre, err)
		}
	}
}

// Una lista definida pero sin contenido util es lo mismo que no tenerla. Sin
// esta validacion el servicio arrancaria con cero origenes permitidos y
// rechazaria absolutamente todo, que se diagnostica mucho peor que no arrancar.
func TestListaSoloConSeparadoresCuentaComoFaltante(t *testing.T) {
	for _, nombre := range []string{"CORS_ORIGENES", "ADMIN_EMAILS"} {
		t.Run(nombre, func(t *testing.T) {
			entornoCompleto(t)
			t.Setenv(nombre, " , , ")

			_, err := Cargar()
			if err == nil {
				t.Fatalf("%s sin contenido util tendria que fallar", nombre)
			}
			if !strings.Contains(err.Error(), nombre) {
				t.Errorf("el error tiene que nombrar %s, dice: %v", nombre, err)
			}
		})
	}
}

func TestListasSeparanYLimpian(t *testing.T) {
	entornoCompleto(t)
	t.Setenv("CORS_ORIGENES", " https://uno.example , https://dos.example ,, ")
	t.Setenv("ADMIN_EMAILS", " Diego@Example.COM , otro@example.com ")

	cfg, err := Cargar()
	if err != nil {
		t.Fatalf("no esperaba error: %v", err)
	}

	quiero := []string{"https://uno.example", "https://dos.example"}
	if len(cfg.OrigenesPermitidos) != len(quiero) {
		t.Fatalf("origenes: quiero %v, dio %v", quiero, cfg.OrigenesPermitidos)
	}
	for i, o := range quiero {
		if cfg.OrigenesPermitidos[i] != o {
			t.Errorf("origen %d: quiero %q, dio %q", i, o, cfg.OrigenesPermitidos[i])
		}
	}

	// Las direcciones se normalizan a minusculas al cargarlas: es la misma
	// normalizacion que implementa FR-007a.
	if cfg.AdminEmails[0] != "diego@example.com" {
		t.Errorf("el admin tiene que quedar en minusculas, dio %q", cfg.AdminEmails[0])
	}
}

// FR-022: quien administra sale del entorno, y la comparacion no puede
// depender de como escribio la direccion quien inicio sesion.
func TestEsAdmin(t *testing.T) {
	entornoCompleto(t)
	t.Setenv("ADMIN_EMAILS", "diego@example.com, otra@example.com")

	cfg, err := Cargar()
	if err != nil {
		t.Fatalf("no esperaba error: %v", err)
	}

	casos := []struct {
		email  string
		quiero bool
	}{
		{"diego@example.com", true},
		{"DIEGO@Example.com", true},
		{"  diego@example.com  ", true},
		{"otra@example.com", true},
		{"cliente@example.com", false},
		{"", false},
	}
	for _, c := range casos {
		if dio := cfg.EsAdmin(c.email); dio != c.quiero {
			t.Errorf("EsAdmin(%q): quiero %v, dio %v", c.email, c.quiero, dio)
		}
	}
}

func TestDuracionInvalidaEsErrorDeArranque(t *testing.T) {
	casos := map[string]string{
		"no parseable": "4w",
		"cero":         "0s",
		"negativa":     "-1h",
	}
	for nombre, valor := range casos {
		t.Run(nombre, func(t *testing.T) {
			entornoCompleto(t)
			t.Setenv("SESION_DURACION", valor)

			if _, err := Cargar(); err == nil {
				t.Fatalf("SESION_DURACION=%q tendria que fallar y no volver al default", valor)
			}
		})
	}
}

func TestDuracionValidaPisaElDefault(t *testing.T) {
	entornoCompleto(t)
	t.Setenv("SESION_DURACION", "48h")
	t.Setenv("RASTRO_RETENCION", "24h")

	cfg, err := Cargar()
	if err != nil {
		t.Fatalf("no esperaba error: %v", err)
	}
	if cfg.SesionDuracion != 48*time.Hour {
		t.Errorf("sesion: quiero 48h, dio %s", cfg.SesionDuracion)
	}
	if cfg.RastroRetencion != 24*time.Hour {
		t.Errorf("rastro: quiero 24h, dio %s", cfg.RastroRetencion)
	}
}
