import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // EL GUION BAJO YA ERA LA CONVENCION DEL CODIGO, y la config no la
      // reconocia (01/09/2026). El resultado eran cinco avisos sobre cosas
      // escritas a proposito:
      //
      //   channel(_nombre: string, _opts?: any)   <- la firma la impone Supabase;
      //                                              el cliente demo no los usa
      //   const { [plantaId]: _, ...rest } = prev <- el idioma para SACAR una
      //                                              clave de un objeto
      //
      // Un aviso sobre algo que esta bien escrito no se arregla: se aprende a
      // ignorar, y con el se ignoran los que si importan. La convencion es
      // explicita —quien pone el guion bajo esta DICIENDO «esto no se usa»— asi
      // que lo correcto es que la herramienta la entienda.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],

      // LAS REGLAS DEL REACT COMPILER, EN `warn` Y NO EN `error` (12/09/2026).
      //
      // Son 33 marcas en 21 archivos, y se revisaron una por una antes de
      // tocar la configuracion. No hay un bug entre ellas.
      //
      // 26 son `set-state-in-effect` sobre esto:
      //
      //   const cargar = useCallback(async () => { setCargando(true); … }, [])
      //   useEffect(() => { cargar() }, [cargar])
      //
      // que es la forma estandar de cargar datos al montar una pantalla. La
      // regla la marca porque el `setCargando(true)` ocurre sincronico al
      // arrancar el efecto.
      //
      // Las 4 de `refs` estan en `useDialogo.ts`, y ahi la lectura del ref
      // durante el render NO es un descuido: es el unico momento en que
      // `document.activeElement` todavia es el boton que abrio el modal, porque
      // React aplica el `autoFocus` en el commit, antes de cualquier efecto —
      // incluso `useLayoutEffect`. Esta medido el 02/09/2026 y escrito en ese
      // archivo con el detalle. «Arreglarlo» rompe la devolucion del foco en
      // los 6 formularios que tienen `autoFocus`.
      //
      // El criterio es el mismo que ya se aplico con los 93 `no-explicit-any`
      // de mas abajo: una herramienta que marca como error lo que esta bien
      // escrito se aprende a ignorar, y con ella se ignora lo que si importa.
      // En `warn` siguen a la vista para quien las busque, y el lint vuelve a
      // servir como puerta de CI: cualquier error NUEVO rompe la build.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // LOS CUATRO MODULOS CUYO TRABAJO ES MANEJAR DATOS SIN FORMA.
    //
    // `no-explicit-any` tiene razon casi siempre, y por eso sigue en `error`
    // para todo el resto. Pero en estos cuatro el `any` no es un descuido: es
    // lo que el modulo ES.
    //
    //   demo/demoClient  emula la API de Supabase contra localStorage. Su tipo
    //                    es el de la libreria que imita, no uno propio.
    //   backup           lee y escribe un JSON de respaldo: la forma del archivo
    //                    es justamente lo que no se puede garantizar.
    //   offlineDb        una cola de operaciones pendientes. El payload es de la
    //                    operacion, no de la cola.
    //   PaginaTablas     renderiza CUALQUIER tabla de la base, por definicion.
    //
    // POR QUE ESTO IMPORTA Y NO ES ESCONDER: eran 93 errores en la linea base, y
    // 93 errores es lo mismo que ninguno — nadie los lee, y un error nuevo de
    // verdad se pierde entre ellos. Es la misma enfermedad que el cruce que
    // marcaba un falso positivo: una herramienta que avisa de mas se aprende a
    // ignorar, y con ella se ignora lo que si importa.
    //
    // Queda en `warn`: siguen apareciendo si alguien los busca, pero no tapan.
    files: [
      'src/lib/demo/**/*.ts',
      'src/lib/backup.ts',
      'src/lib/offlineDb.ts',
      'src/pages/PaginaTablas.tsx',
    ],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
])
