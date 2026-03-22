# Minecraft Skin Layout Maker

App para convertir una imagen frontal completa de un personaje en una skin clásica de Minecraft (`64x64`).

## Descarga rápida

### Ejecutable listo para descargar desde este proyecto
- Descarga `dist/MinecraftSkinMaker`.
- Si hace falta, dale permisos: `chmod +x dist/MinecraftSkinMaker`
- Haz doble clic o ejecútalo desde la terminal.
- El ejecutable dejará la app lista y la abrirá en tu navegador automáticamente.

> Nota: este ejecutable generado aquí es un lanzador portable para **Linux/macOS**. Para un `.exe` nativo de Windows habría que empaquetarlo desde un entorno Windows o con una cadena de build específica para Windows.

## La forma más fácil (sin programar)

### Windows
1. Descarga la carpeta o el ZIP.
2. Descomprímelo.
3. Haz doble clic en `Abrir Skin Maker.bat`.

### Mac o Linux
1. Descarga la carpeta o el ZIP.
2. Descomprímelo.
3. Haz doble clic en `Abrir Skin Maker.command` o usa `dist/MinecraftSkinMaker`.
4. Si tu sistema lo bloquea, abre el archivo manualmente con el navegador.

### Alternativa universal
También puedes hacer doble clic en `minecraft-skin-maker.html` y se abrirá en tu navegador sin instalar nada.

## Cómo usar la app

1. Haz clic en **Haz clic para subir una imagen**.
2. Sube tu imagen (`PNG`, `JPG` o `WEBP`).
3. Ajusta los controles si el recorte no sale perfecto.
4. Haz clic en **Descargar skin PNG**.
5. Usa el archivo descargado como skin de Minecraft.

## Regenerar el ejecutable

Si quieres volver a generar el ejecutable portable:

```bash
./build-linux-executable.sh
```

El archivo se generará en `dist/MinecraftSkinMaker`.

## Modo técnico opcional

Si prefieres ejecutarla como servidor local:

```bash
npm start
```

Luego abre `http://localhost:4173`.

## Verificación rápida

```bash
npm run check
```
