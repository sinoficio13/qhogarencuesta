# Test manual paso a paso — QHogar Encuestas

**Sitio:** https://qhogarencuesta.vercel.app · **Login admin:** `qhogar1309`

Hacé los pasos en orden. Cada uno dice **HACÉ** (qué tocar) y **DEBE PASAR** (qué tenés que ver).
Marcá ✅ o ❌ al costado. Hacelo en el **teléfono** (es donde más importa).

> Vas a generar respuestas de prueba reales. Usá los emails `prueba1@test.com`, etc.
> Al final, avisame y te reseteo el contador a 0 antes de difundir.

---

## PARTE 1 — Responder la encuesta (lo que ve la gente)

**1.1 — Abrir**
HACÉ: en el teléfono, andá a `qhogarencuesta.vercel.app/buyers`
DEBE PASAR: carga "Encuesta a compradores", se lee cómodo, sin texto cortado. → ✅/❌

**1.2 — Intentar enviar vacío**
HACÉ: escribí `prueba1@test.com` en el email, NO respondas nada, tocá "Enviar respuestas".
DEBE PASAR: NO se envía. Aparece un cartel y las preguntas sin responder se marcan en **naranja** con mensajes ("Elegí una opción…", "Puntuá todas las filas…"). → ✅/❌

**1.3 — Email inválido**
HACÉ: cambiá el email a `holamundo` (sin @), respondé TODAS las preguntas, tocá "Enviar".
DEBE PASAR: el campo del email se pone con **borde naranja** y dice *"Ingresá un email válido (ej: nombre@dominio.com)."* No se envía. → ✅/❌

**1.4 — Tope de 2 (pregunta 5)**
HACÉ: en "¿qué te haría usarla en vez de Idealista o Fotocasa?", marcá 2 opciones, intentá marcar una 3.ª.
DEBE PASAR: la 3.ª no se puede marcar (las demás quedan grises). → ✅/❌

**1.5 — Enviar bien (camino feliz)** ⭐ el más importante
HACÉ: poné `prueba1@test.com`, respondé todas, tocá "Enviar respuestas".
DEBE PASAR: aparece **"¡Gracias! Respuesta registrada — Tu respuesta se ha guardado correctamente."** → ✅/❌

**1.6 — Mismo email no entra dos veces (dedup)**
HACÉ: volvé a `/buyers`, poné OTRA VEZ `prueba1@test.com`, respondé todo, enviá.
DEBE PASAR: **NO** te deja; muestra un mensaje tipo "Ya registraste/respondiste con este email". → ✅/❌

**1.7 — Otro email sí puede**
HACÉ: volvé a `/buyers`, poné `prueba2@test.com`, respondé todo, enviá.
DEBE PASAR: "¡Gracias! Respuesta registrada". → ✅/❌

**1.8 — Agentes funciona igual**
HACÉ: andá a `/agents`, respondé con `agente1@test.com`, enviá.
DEBE PASAR: tarjeta de gracias. → ✅/❌

**1.9 — Ruta que no existe**
HACÉ: andá a `qhogarencuesta.vercel.app/cualquiercosa`
DEBE PASAR: página **404**. → ✅/❌

**1.10 — Home**
HACÉ: andá a `qhogarencuesta.vercel.app/` (raíz, sin nada más)
DEBE PASAR: te lleva al **login del admin**. → ✅/❌

---

## PARTE 2 — El panel admin

**2.1 — Login mal**
HACÉ: en `/admin`, poné una contraseña cualquiera mal, "Ingresar".
DEBE PASAR: dice **"Contraseña incorrecta."**, no entra. → ✅/❌

**2.2 — Login bien**
HACÉ: poné `qhogar1309`, "Ingresar".
DEBE PASAR: entrás al panel "QHogar — Panel Admin". → ✅/❌

**2.3 — Avance**
HACÉ: mirá el bloque "Avance" arriba.
DEBE PASAR: muestra el total de respuestas y, por encuesta: **Compradores = 2**, **Agentes = 1** (las que enviaste), con la fecha de la última. → ✅/❌

**2.4 — Ver resultados** ⭐
HACÉ: tocá "Ver resultados" en Compradores.
DEBE PASAR: "2 RESPUESTAS TOTALES", y por pregunta ves **barras con % por opción** y **promedios /5** en las escalas. Coincide con lo que respondiste. → ✅/❌

**2.5 — Exportar CSV**
HACÉ: volvé al panel, tocá "Exportar CSV" en Compradores.
DEBE PASAR: se **descarga** un archivo `respuestas-buyers.csv`. Abrilo: una fila por respuesta, los acentos se ven bien. → ✅/❌

**2.6 — Compartir**
HACÉ: tocá "Compartir" en una encuesta.
DEBE PASAR (teléfono): se abre la hoja de compartir (WhatsApp, etc.). DEBE PASAR (PC): el botón dice "¡Copiado!" y el link queda en el portapapeles. → ✅/❌

**2.7 — QR**
HACÉ: en el panel (desde la PC), escaneá el QR con la cámara del teléfono.
DEBE PASAR: el teléfono abre el login del panel. → ✅/❌

---

## PARTE 3 — Editor (USÁ UNA ENCUESTA DE PRUEBA, no las reales)

**3.1 — Crear encuesta de prueba**
HACÉ: en el panel, "+ Nueva encuesta" → Título `Prueba`, Slug `prueba` → "Crear encuesta".
DEBE PASAR: aparece "Prueba" en la lista, ACTIVA; `/prueba` abre en otra pestaña. → ✅/❌

**3.2 — Agregar pregunta (4 tipos)**
HACÉ: en "Prueba" → "Preguntas" → "+ Agregar pregunta". Probá los 4 tipos uno por uno (Opción única, Opción múltiple, Escala 1–5, Respuesta abierta), poné un texto y "Crear pregunta".
DEBE PASAR: al elegir **"Opción múltiple"** aparece el campo "Máximo de opciones a elegir" (NO aparece en los otros). Cada pregunta se crea y aparece en la lista. → ✅/❌

**3.3 — Agregar opciones**
HACÉ: en la pregunta de opción única, usá "+ Opción" (probá una "Normal" y una "Control").
DEBE PASAR: las opciones aparecen; la control queda etiquetada "control". → ✅/❌

**3.4 — Editar**
HACÉ: "Editar pregunta", cambiá el texto, guardá.
DEBE PASAR: el cambio se ve. → ✅/❌

**3.5 — Reordenar**
HACÉ: tocá ↑ / ↓ en una pregunta.
DEBE PASAR: cambia de orden, **sin error de servidor**. → ✅/❌

**3.6 — Borrar pregunta y opción**
HACÉ: tocá la ✕ de una opción y la ✕ de una pregunta.
DEBE PASAR: se borran. → ✅/❌

**3.7 — La pregunta llega al público**
HACÉ: abrí `/prueba`.
DEBE PASAR: las preguntas que dejaste aparecen para responder. → ✅/❌

**3.8 — Desactivar**
HACÉ: en el panel, "Desactivar" en "Prueba". Después abrí `/prueba`.
DEBE PASAR: queda "INACTIVA"; `/prueba` da **404**. → ✅/❌

**3.9 — Borrar la encuesta de prueba**
HACÉ: "Borrar" en "Prueba".
DEBE PASAR: desaparece de la lista; `/prueba` da 404. → ✅/❌

---

## Al terminar

- Decime qué número falló (ej. "falló 1.5 y 2.4") y qué viste.
- Avisame para **resetear el contador de respuestas a 0** (vas a tener prueba1, prueba2, agente1 contadas) antes de difundir.
