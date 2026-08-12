// Genera el icono del sitio a partir del logo: el camion, blanco, sobre un
// cuadrado redondeado en el azul de marca.
//
// Por que el camion solo y no el logo entero: a 16x16 —el tamano real de una
// pestana— el texto "FLASH URBANO / LOGISTICA Y TRANSPORTE" es una mancha gris.
// El camion es la parte que se reconoce.
//
// Por que sobre azul y no sobre transparente: un camion blanco sobre nada
// DESAPARECE en las pestanas de tema claro, que son el default de Windows y de
// Chrome. Ademas el logo fue dibujado sobre ese azul, asi que las contraformas
// internas del camion —la ventana, los huecos de las ruedas, que quedaron
// transparentes al destondear el logo— vuelven a asomar en azul justo donde
// asomaban en el original. No se aproxima la composicion: se restaura.
//
//   cd web
//   node design-source/build-favicon.js
//
// Emite tres archivos en app/, que Next resuelve por convencion (no hay que
// tocar layout.tsx):
//
//   app/favicon.ico     16, 32 y 48 — pestanas y el /favicon.ico que el
//                       navegador pide solo
//   app/icon.svg        pestanas modernas
//   app/apple-icon.png  180x180 — pantalla de inicio de iOS

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const FUENTE = path.join(RAIZ, "public", "logo-flash-urbano.png");
const SALIDA = path.join(RAIZ, "app");

/**
 * Azul de marca, MEDIDO sobre el propio logo: es el color exacto mas frecuente
 * entre sus azules. No es un azul "parecido" elegido a ojo.
 */
const AZUL = "#032F9A";

/**
 * Donde buscar el camion dentro del logo.
 *
 * No es el recorte final: es la REGION DE BUSQUEDA, y adentro de ella el script
 * calcula el recorte ajustado al contenido. Se hace asi para que un reprocesado
 * del logo que lo mueva unos pixeles no rompa el icono en silencio.
 *
 * Los limites salen de medir el logo, no de estimarlo:
 *   - a la izquierda de x=430 empiezan las lineas naranjas de velocidad
 *   - debajo de y=175 estan la barra naranja y el texto
 */
const REGION = { x: 430, y: 0, ancho: 170, alto: 175 };

/**
 * Region para los tamanos CHICOS: el vehiculo sin las lineas de velocidad.
 *
 * No es una preferencia estetica, es una medicion. Se renderizo el icono a 16px
 * con la region completa y se lo miro al tamano real: las lineas naranjas se
 * comen el tercio izquierdo en puro ruido —a 16px son tres pixeles anaranjados
 * sin forma— y le dejan al camion tan pocos pixeles que deja de leerse como un
 * camion. Ese era el punto de decision declarado en el plan (D1).
 *
 * x=449 es donde arranca la masa solida del vehiculo: la racha vertical de
 * pixeles blancos salta de ~20 a 45 ahi, y sigue creciendo hacia la derecha.
 * Medido, no estimado.
 *
 * A 32px y para arriba SI entran las lineas: ahi ya se leen como movimiento, que
 * es lo que el logo quiere decir con ellas.
 */
const REGION_CHICA = { x: 449, y: 0, ancho: 151, alto: 175 };

/** A partir de aca entran las lineas de velocidad. */
const UMBRAL_CHICO = 24;

/**
 * Cuanto respira el camion dentro del cuadrado, por tamano.
 *
 * Los chicos llevan MENOS margen a proposito: a 16px cada pixel cuenta, y el
 * margen que hace elegante a un icono de 180 lo vuelve ilegible a 16. Es la
 * misma razon por la que los iconos de sistema tienen versiones dibujadas
 * aparte para los tamanos chicos.
 */
function margenPara(tamano) {
  if (tamano <= 16) return 0.06;
  if (tamano <= 32) return 0.07;
  if (tamano <= 48) return 0.09;
  return 0.12;
}

/** Radio de las esquinas: proporcion fija para que se vea igual a cualquier tamano. */
const RADIO = 0.2;

function fondoSVG(tamano) {
  const r = Math.round(tamano * RADIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}">` +
      `<rect width="${tamano}" height="${tamano}" rx="${r}" ry="${r}" fill="${AZUL}"/>` +
      `</svg>`
  );
}

/**
 * El recorte ajustado del camion, con su bbox real dentro de REGION.
 *
 * Falla ruidosamente si el resultado no tiene sentido. Un icono generado a
 * medias es peor que ninguno: nadie lo mira de cerca despues.
 */
async function recortarCamion(REGION) {
  const region = sharp(FUENTE).extract({
    left: REGION.x,
    top: REGION.y,
    width: REGION.ancho,
    height: REGION.alto,
  });

  const { data, info } = await region
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 32) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }

  const ancho = x1 - x0 + 1;
  const alto = y1 - y0 + 1;
  if (ancho < 80 || alto < 80) {
    throw new Error(
      `el recorte del camion dio ${ancho}x${alto}, demasiado chico. ` +
        `Cambio el logo? Revisar REGION en este script.`
    );
  }

  console.log(
    `recorte desde x=${REGION.x}: ${ancho}x${alto} px  ` +
      `(bbox ${REGION.x + x0}..${REGION.x + x1}, ${y0}..${y1} del logo)`
  );

  return {
    buffer: await sharp(FUENTE)
      .extract({
        left: REGION.x + x0,
        top: REGION.y + y0,
        width: ancho,
        height: alto,
      })
      .png()
      .toBuffer(),
    ancho,
    alto,
  };
}

/** Un PNG cuadrado con el camion sobre el fondo azul. */
async function componer(camion, tamano) {
  const util = Math.round(tamano * (1 - 2 * margenPara(tamano)));

  // Ajusta por el lado mas largo para que entre entero sin deformarse. El
  // camion es casi cuadrado (170x164), asi que la diferencia es minima — pero
  // "casi" no es "es", y estirarlo se nota en el tamano grande.
  const escala = util / Math.max(camion.ancho, camion.alto);
  const w = Math.max(1, Math.round(camion.ancho * escala));
  const h = Math.max(1, Math.round(camion.alto * escala));

  const encogido = await sharp(camion.buffer)
    .resize(w, h, { fit: "fill", kernel: "lanczos3" })
    .toBuffer();

  return sharp(fondoSVG(tamano))
    .composite([
      {
        input: encogido,
        left: Math.round((tamano - w) / 2),
        top: Math.round((tamano - h) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Arma un .ico con los PNG ya renderizados.
 *
 * sharp no escribe .ico, y el formato es simple: cabecera, un directorio de
 * entradas de 16 bytes, y los datos. Se guardan como PNG adentro del contenedor
 * —el .ico lo admite desde Vista— en vez de como BMP: pesa mucho menos y lo
 * entiende todo lo que este sitio soporta.
 */
function armarICO(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(imagenes.length, 4);

  const directorio = Buffer.alloc(16 * imagenes.length);
  let desplazamiento = cabecera.length + directorio.length;

  imagenes.forEach(({ tamano, datos }, i) => {
    const e = i * 16;
    // 0 significa 256. Ninguno de nuestros tamanos llega, pero dejarlo escrito
    // evita que alguien agregue 256 y produzca un archivo invalido.
    directorio.writeUInt8(tamano >= 256 ? 0 : tamano, e + 0);
    directorio.writeUInt8(tamano >= 256 ? 0 : tamano, e + 1);
    directorio.writeUInt8(0, e + 2); // paleta
    directorio.writeUInt8(0, e + 3); // reservado
    directorio.writeUInt16LE(1, e + 4); // planos
    directorio.writeUInt16LE(32, e + 6); // bits por pixel
    directorio.writeUInt32LE(datos.length, e + 8);
    directorio.writeUInt32LE(desplazamiento, e + 12);
    desplazamiento += datos.length;
  });

  return Buffer.concat([cabecera, directorio, ...imagenes.map((i) => i.datos)]);
}

(async () => {
  const camion = await recortarCamion(REGION);
  const camionChico = await recortarCamion(REGION_CHICA);
  const para = (tamano) => (tamano <= UMBRAL_CHICO ? camionChico : camion);

  // --- favicon.ico -------------------------------------------------------
  const tamanos = [16, 32, 48];
  const imagenes = [];
  for (const tamano of tamanos) {
    imagenes.push({ tamano, datos: await componer(para(tamano), tamano) });
  }
  const ico = path.join(SALIDA, "favicon.ico");
  fs.writeFileSync(ico, armarICO(imagenes));
  console.log(`favicon.ico     ${tamanos.join(", ")}  ${fs.statSync(ico).size} B`);

  // --- apple-icon.png ----------------------------------------------------
  const apple = path.join(SALIDA, "apple-icon.png");
  fs.writeFileSync(apple, await componer(camion, 180));
  console.log(`apple-icon.png  180x180  ${fs.statSync(apple).size} B`);

  // --- icon.svg ----------------------------------------------------------
  // Lleva el recorte embebido como PNG, no vectorizado. Vectorizar un raster
  // automaticamente da curvas sucias, y hacerlo a mano es dibujar un camion
  // nuevo — que es justo lo que este script existe para no hacer.
  const LADO = 512;
  const util = Math.round(LADO * (1 - 2 * margenPara(LADO)));
  const escala = util / Math.max(camion.ancho, camion.alto);
  const w = Math.round(camion.ancho * escala);
  const h = Math.round(camion.alto * escala);

  // El raster embebido se limita a 200px de lado aunque el viewBox sea 512.
  //
  // El SVG se lo descarga TODO el que entra al sitio, y un favicon de 200 kB es
  // absurdo cuando el .ico entero pesa 6. A 200px el navegador tiene de sobra
  // para cualquier pestana, incluso en pantallas de alta densidad, y el archivo
  // baja a la decima parte. Que el viewBox siga siendo 512 es lo que hace que
  // escale limpio: el <image> se estira, no se pixela hasta bastante mas grande
  // de lo que una pestana llega a usar.
  const RASTER_MAX = 200;
  const rw = Math.min(w, RASTER_MAX);
  const rh = Math.round((h / w) * rw);
  // Paleta en vez de color verdadero: el camion son tres colores y sus bordes
  // suavizados, asi que 64 entradas alcanzan de sobra y el archivo baja otra
  // vez a la mitad. Se mide al final y se imprime — si algun dia sube, es que
  // esto dejo de andar.
  const incrustado = (
    await sharp(camion.buffer)
      .resize(rw, rh, { kernel: "lanczos3" })
      .png({ palette: true, colours: 64, effort: 10 })
      .toBuffer()
  ).toString("base64");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">\n` +
    `  <rect width="${LADO}" height="${LADO}" rx="${Math.round(LADO * RADIO)}" ry="${Math.round(LADO * RADIO)}" fill="${AZUL}"/>\n` +
    `  <image x="${Math.round((LADO - w) / 2)}" y="${Math.round((LADO - h) / 2)}" width="${w}" height="${h}"\n` +
    `         href="data:image/png;base64,${incrustado}"/>\n` +
    `</svg>\n`;

  const rutaSvg = path.join(SALIDA, "icon.svg");
  fs.writeFileSync(rutaSvg, svg);
  console.log(`icon.svg        ${LADO}x${LADO}  ${fs.statSync(rutaSvg).size} B`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
