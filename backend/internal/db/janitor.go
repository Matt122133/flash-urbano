package db

import (
	"context"
	"log"
	"time"
)

// IntervaloJanitor es cada cuanto corren las purgas.
//
// Una vez por hora alcanza de sobra: lo que se borra tiene una vida de dias o
// meses, asi que una hora de retraso no cambia nada. Mas seguido seria trabajo
// de base para nada.
const IntervaloJanitor = time.Hour

// Tarea es una limpieza periodica.
//
// Devuelve cuantas filas toco, para que quede registrado. Un contador que
// siempre da cero es la senal de que algo dejo de funcionar.
type Tarea struct {
	Nombre string
	Correr func(context.Context) (int64, error)
}

// ArrancarJanitor corre las tareas de limpieza cada IntervaloJanitor, hasta que
// se cancele el contexto.
//
// Existe porque una funcion de purga que nadie dispara no purga nada. Es el
// modo de falla real de este tipo de codigo: la funcion esta escrita, tiene su
// prueba, y la tabla crece igual para siempre porque no la llama nadie.
//
// Bloquea; el llamador la corre en su propia goroutine.
func ArrancarJanitor(ctx context.Context, tareas ...Tarea) {
	if len(tareas) == 0 {
		return
	}

	// Una pasada al arrancar. Si el servicio se reinicia seguido —que en
	// Railway pasa con cada despliegue— esperar una hora entera para la primera
	// limpieza significaria no limpiar nunca.
	correrTodas(ctx, tareas)

	ticker := time.NewTicker(IntervaloJanitor)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			correrTodas(ctx, tareas)
		}
	}
}

func correrTodas(ctx context.Context, tareas []Tarea) {
	for _, t := range tareas {
		// Cada tarea con su propio plazo: una consulta trabada no puede dejar
		// sin correr a las que vienen despues.
		ctxTarea, cancelar := context.WithTimeout(ctx, 2*time.Minute)
		borradas, err := t.Correr(ctxTarea)
		cancelar()

		if err != nil {
			log.Printf("janitor: %s fallo: %v", t.Nombre, err)
			continue
		}
		if borradas > 0 {
			log.Printf("janitor: %s borro %d filas", t.Nombre, borradas)
		}
	}
}
