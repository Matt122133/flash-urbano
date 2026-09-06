# Feature Specification: Encontrar un pedido entre muchos

**Feature Branch**: `023-encontrar-un-pedido`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "poner filtros en la seccion de mis pedidos, porque cuando la empresa tenga muchos —50 pedidos— va a ser un quilombo que los puedan ver"

## Por que existe

Hoy *Mi cuenta → Mis pedidos* muestra **los 5 mas recientes y un "Ver todos"**,
y a partir de ahi es una lista sin cortes, del mas nuevo al mas viejo. Con cinco
pedidos alcanza. Con cincuenta, quien entra a mirar **un** pedido tiene que
recorrerlos todos con el ojo.

**Lo que duele no es el volumen de datos, es encontrar uno.** El peso ya esta
medido y anotado: `docs/tech-debt-tracker.md`, fila del 2026-08-22 — ~700 bytes
por pedido, incomodo recien **arriba de ~300 pedidos por persona**. A 50 la
respuesta se baja sin que nadie lo note. Por eso este feature es de busqueda y
recorte en pantalla, y **el paginado sigue sin construirse**, con su umbral
intacto en el tracker (Principio III).

La pantalla ademas dejo de ser solo de consulta: desde `022` es **desde donde se
corrige o se da de baja** un pedido pendiente. Encontrar el pedido es ahora el
primer paso de una accion, no solo de una mirada.

## Clarifications

### Session 2026-09-06

- Q: Cuando la persona sale de la pantalla y vuelve, ¿el filtro sigue puesto? → A: viaja en la URL (`/perfil?ver=pedidos&estado=pendientes`): sobrevive recargar y el boton de atras, pero entrar de nuevo desde el menu da la lista completa.
- Q: ¿El filtro por fecha (US3) entra en este feature? → A: se difiere. Entran el corte por estado y la busqueda.
- Q: El corte por estado, ¿uno a la vez o varios a la vez? → A: uno a la vez.
- Q: ¿Sobre que campos busca el texto? → A: solo codigo y nombre de quien recibe. La direccion de entrega queda afuera.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver solo los pendientes (Priority: P1)

Quien manda seguido entra casi siempre por lo mismo: **que hay en curso**. Los
pedidos ya entregados son historia, y son la parte de la lista que crece para
siempre; los pendientes y los aceptados son los que todavia pueden necesitar
algo — corregir una direccion, dar de baja, avisar algo.

**Why this priority**: es el corte que resuelve el problema con **un solo gesto y
sin escribir nada**, y es el unico que sirve igual en un telefono con una mano.
Ademas es el que habilita la accion de `022`: editar y dar de baja **solo existen
mientras el pedido este pendiente**, asi que "mostrame los pendientes" y
"mostrame lo que todavia puedo cambiar" son la misma pregunta.

**Independent Test**: con una cuenta que tenga pedidos en los tres estados, tocar
el corte de pendientes y ver que quedan solo esos, sin escribir nada.

**Acceptance Scenarios**:

1. **Given** una cuenta con 50 pedidos de los cuales 3 estan pendientes,
   **When** la persona elige ver solo los pendientes,
   **Then** la lista muestra esos 3 y ninguno mas, y **no hace falta tocar "Ver
   todos"** para verlos completos.
2. **Given** el corte de pendientes aplicado,
   **When** la persona da de baja uno desde esa misma lista (`022`),
   **Then** el pedido desaparece de la lista y **el corte sigue aplicado** — no
   vuelve sola a la lista completa.
3. **Given** una cuenta sin ningun pedido pendiente,
   **When** elige ver solo los pendientes,
   **Then** ve un vacio que dice que no hay pendientes, **distinto** del vacio de
   quien todavia no hizo ningun envio.

---

### User Story 2 - Buscar el pedido que tengo en la cabeza (Priority: P2)

La persona no se acuerda del codigo: se acuerda de **para quien era** ("el que le
mande a Sofia"). A veces si tiene el codigo, porque se lo dio a quien recibe o lo
tiene en un mensaje.

**La direccion de entrega NO entra en la busqueda**, por decision de Mateo del
2026-09-06 y en contra de la recomendacion: el dato ya viaja en la respuesta, asi
que la razon no es el costo. Buscar "el de Rivera y Soca" no encuentra nada, y
eso es deliberado — una calle aparece en muchos pedidos y ensuciaria los
resultados.

**Why this priority**: cubre el caso que el corte por estado no cubre — un pedido
viejo y entregado, que es justo el que esta enterrado. Vale menos que US1 porque
exige escribir, y en el telefono eso es mas trabajo que tocar un boton.

**Independent Test**: escribir parte del nombre de un destinatario y ver que
quedan solo los pedidos que le corresponden.

**Acceptance Scenarios**:

1. **Given** una cuenta con 50 pedidos, **When** escribe parte del nombre de un
   destinatario, **Then** quedan solo los pedidos de ese destinatario.
2. **Given** el codigo `FU-0142`, **When** escribe `142`, `fu-0142` o `FU-0142`,
   **Then** encuentra el mismo pedido en los tres casos.
3. **Given** un destinatario escrito con tilde en el pedido, **When** lo busca
   **sin** tilde (o al reves), **Then** lo encuentra igual.
4. **Given** una busqueda sin resultados, **When** mira la pantalla, **Then**
   entiende que **no hay coincidencias** y puede volver a la lista completa con
   un solo gesto.

---

### Diferido - Acotar por cuando fue

"El envio del mes pasado" es la tercera forma de recordar un pedido, y **queda
fuera de este feature** por decision de Mateo del 2026-09-06: es la menos usada
de las tres y la que mas superficie agrega a una pantalla cuyas tarjetas ya
tienen acciones adentro. US1 y US2 resuelven el caso que motivo el pedido.

Si vuelve, la fecha que cuenta es la de **retiro** —la que la persona recuerda
("el envio del martes")— y no la de creacion.

---

### Edge Cases

- **Los dos vacios no son el mismo vacio.** "Todavia no hiciste ningun envio"
  invita a crear el primero; "ningun pedido coincide" tiene que ofrecer limpiar
  el filtro. Mostrar el primero cuando pasa el segundo le dice a la persona que
  perdio sus pedidos.
- **Un estado que la pantalla no conoce.** El servicio guarda el estado como
  texto y la lista ya cambio una vez; un pedido con un estado nuevo **no puede
  desaparecer** de la lista por no encajar en ningun corte.
- **Filtrar mientras se edita o se da de baja** (`022`): al refrescarse la lista,
  el filtro sobrevive; el pedido que dejo de existir, no.
- **Servicio caido o sesion vencida**: los controles de filtro no pueden tapar el
  aviso de error ni el boton de reintentar, y no tiene sentido ofrecer filtrar
  una lista que no llego.
- **Sin sesion**: la pantalla no muestra ni pide nada, como hoy.
- **Pocos pedidos**: con 3 pedidos, los controles no pueden estorbar mas de lo
  que ayudan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla MUST permitir acotar la lista **por estado**, con al
  menos un corte que deje ver solo los pedidos **pendientes**. Los cortes son
  **excluyentes: uno a la vez**, no una combinacion. Con cuatro opciones —todos,
  pendientes, aceptados, entregados— la multiseleccion son dieciseis estados
  posibles que explicar, y el color que marca cual esta puesto (FR-015) dejaria
  de senalar uno solo.
- **FR-002**: La pantalla MUST permitir **buscar por texto** sobre el **codigo** y
  el **nombre de quien recibe**, y MUST NOT buscar sobre las direcciones.
- **FR-003**: La busqueda por codigo MUST encontrar el pedido **con o sin el
  prefijo** y sin distinguir mayusculas.
- **FR-004**: La busqueda por texto MUST ignorar **tildes y mayusculas**. Es la
  leccion que el indice de calles ya dejo escrita en este repo: el mismo nombre
  aparece escrito de dos formas, y la busqueda que no normaliza no encuentra
  nada.
- **FR-005**: Un pedido con un estado **que la pantalla no reconoce** MUST seguir
  siendo visible en la lista sin filtros.
- **FR-006**: Con filtros aplicados y **cero coincidencias**, la pantalla MUST
  decir que no hay coincidencias y ofrecer **volver a la lista completa**, y MUST
  NOT mostrar el mensaje de "todavia no hiciste ningun envio".
- **FR-007**: El **conteo** de lo que se esta viendo MUST ser visible cuando hay
  un filtro aplicado, para que nadie confunda "no hay" con "no se muestran".
- **FR-008**: Los filtros MUST sobrevivir a que la lista se recargue por una
  accion de `022` (editar o dar de baja).
- **FR-009**: El **orden** de la lista MUST seguir siendo el que pone el
  servicio, del mas nuevo al mas viejo. Filtrar quita, no reordena.
- **FR-010**: El texto que la persona escribe para buscar **MUST NOT quedar
  guardado en el dispositivo**. Puede contener el **nombre de un tercero que no
  consintio nada**, y es exactamente lo que FR-021 de `010` prohibio guardar
  cuando decidio que repetir un pedido viajara por la URL y no por
  almacenamiento.
- **FR-011**: Los controles de filtro MUST NOT mostrarse cuando la lista no
  llego: sin sesion, mientras carga, o con el servicio caido. El aviso de error y
  su reintento mandan.
- **FR-012**: La pantalla MUST seguir funcionando **sin usar ningun filtro**: los
  controles agregan una forma de encontrar, no reemplazan la lista.
- **FR-013**: Al encontrarlo, la persona MUST poder hacer sobre ese pedido **todo
  lo que hoy puede hacer** desde la lista: ver el detalle, repetirlo, imprimir la
  etiqueta, y editarlo o darlo de baja si sigue pendiente.
- **FR-014**: Ninguna superficie de este feature MUST mostrar ni mencionar un
  monto (constitucion 5.x). No se puede filtrar ni ordenar por precio.
- **FR-015**: Si un filtro queda aplicado, la persona MUST poder ver **de un
  vistazo que lo esta** — un filtro invisible es un producto que perdio pedidos.
- **FR-016**: El filtro aplicado MUST viajar **en la URL**. En consecuencia:
  recargar la pantalla o volver con el boton de atras lo conserva, y **entrar de
  nuevo desde el menu muestra la lista completa**, porque ese camino no lleva el
  parametro. Es el mismo mecanismo que ya usan `?ver=`, `?repetir=` y `?editar=`,
  y resuelve las dos mitades del problema: nadie se encuentra dias despues con un
  filtro que no recuerda haber puesto, y a nadie se le borra por recargar.
- **FR-017**: Por FR-010, **el texto buscado no viaja en la URL**: una URL se
  comparte, se copia a un chat y queda en el historial del navegador, y ese texto
  puede ser el nombre de un tercero. Lo que viaja es el corte por estado.

### Key Entities

- **Pedido**: lo que ya existe. Los campos que este feature mira son **codigo**,
  **estado** y **nombre de quien recibe**; los tres ya se muestran hoy en la
  tarjeta o en su detalle.
- **Filtro aplicado**: que subconjunto de la lista se esta viendo. No es un dato
  del negocio: es estado de pantalla, y por FR-010 su parte de texto no se
  escribe en ningun lado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con **50 pedidos** cargados, una persona encuentra un pedido
  concreto —del que recuerda destinatario o codigo— en **menos de 15 segundos** y
  **sin recorrer la lista con el ojo**.
- **SC-002**: Ver **todos los pedidos que todavia se pueden corregir o dar de
  baja** cuesta **un solo gesto**, sin escribir nada y sin abrir "Ver todos".
- **SC-003**: En **el 100%** de los casos sin resultados, la pantalla dice cual de
  las dos cosas pasa —no hay pedidos, o no hay coincidencias— y ofrece la salida
  que corresponde.
- **SC-004**: Con 50 pedidos, **ningun** pedido queda invisible: lo que muestran
  los cortes disponibles cubre la lista entera, incluidos los pedidos con un
  estado que la pantalla no conoce.
- **SC-005**: La pantalla sigue mostrando la lista completa y utilizable con
  **cero filtros tocados**, igual que antes de este feature.

## Assumptions

- **El alcance es la pantalla del cliente en la web.** La lista de la app de
  Diego —que tiene el mismo problema con mas pedidos y su propia fila `High` en
  el tracker desde el 2026-08-26— **queda afuera** y es otro feature. Decision de
  Mateo el 2026-09-06.
- **No se agrega paginado ni filtrado del lado del servicio.** El umbral que lo
  justificaria (~300 pedidos por persona) esta lejos y ya esta anotado; construir
  media pantalla de servicio para 50 pedidos es lo que el Principio III prohibe.
  Si este feature se construye sobre lo que la respuesta ya trae, un paginado
  futuro no lo invalida: seguira siendo la misma pantalla filtrando lo que tenga
  a mano.
- **El naranja de marca es para el filtro ACTIVO, y solo para ese.** Lo decidio
  Mateo el 2026-09-06. El token existe —`--accent: #f97316`, el mismo naranja que
  usa la app de Diego— pero hoy significa **la accion principal**: es el boton de
  *Crear pedido* en la nav y en la home. Pintar de naranja todos los controles de
  filtro haria que el color mas fuerte de la pantalla signifique dos cosas
  distintas. El ambar tampoco esta libre: es el lenguaje de los avisos. Asi que
  el naranja marca **cual esta puesto**, y los demas controles van en contorno.
- **Los estados son tres** —pendiente, aceptado, entregado— y la pantalla ya los
  traduce. FR-005 existe porque esa lista ya cambio una vez.
- Este feature **no toca la app Android** ni el servicio, asi que no hay APK
  nuevo para instalar a mano.
