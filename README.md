# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Supabase Google Login

Se il login Google apre un URL tipo `/auth/v1/authorize?...provider=google` e mostra `Unsupported provider: provider is not enabled`, il codice e corretto ma il provider Google e disattivato nel progetto Supabase.

1. Apri Supabase Dashboard > Authentication > Providers > Google.
2. Abilita Google e inserisci Client ID e Client Secret creati in Google Cloud.
3. In Google Cloud aggiungi questo Authorized redirect URI:

```text
https://yocfblqnyurabqxbjjei.supabase.co/auth/v1/callback
```

4. In Supabase > Authentication > URL Configuration aggiungi tra gli Additional Redirect URLs:

```text
http://localhost:5173/
```

5. Nel file `.env`, se vuoi forzare il redirect locale, imposta:

```text
VITE_SUPABASE_REDIRECT_URL=http://localhost:5173/
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
