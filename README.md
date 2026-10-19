# Loren's Art · Landing de captura de prospectos

Landing page mobile-first (Vite + Supabase) para la Fase 2 del reto Radar TOFU.

## Variables de entorno (configurar en Vercel)

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (pública) |

Nunca uses aquí la *secret key* ni la *service_role*.

## Despliegue en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel: **Add New → Project → Import** el repositorio.
3. Framework: **Vite** (se detecta solo). Build: `npm run build`. Output: `dist`.
4. En **Environment Variables**, agrega las dos variables de la tabla.
5. **Deploy**.

## Prueba social

Edita `config.js` y agrega reseñas reales de clientes de Loren's Art en `testimonios`.

## Desarrollo local (opcional)

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev
```
