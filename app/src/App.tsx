import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, useState } from 'react'
import { Toaster } from 'sonner'
import { useAuth } from './hooks/useAuth'
import { RutaConPermiso } from './components/RutaConPermiso'
import Layout from './components/layout/Layout'
import PaginaLogin from './pages/PaginaLogin'
import PaginaPanel from './pages/PaginaPanel'
import ErrorBoundary from './components/ErrorBoundary'
import PinLock from './components/PinLock'
import { tienePin, estaDesbloqueado } from './lib/pin'
import { ConfirmProvider } from './hooks/useConfirm'
import { lazyWithRetry } from './lib/lazyWithRetry'
import { LLEGO_POR_ENLACE } from './lib/enlaceDeAcceso'
import PaginaClave from './pages/PaginaClave'

// Version personal: solo las paginas adaptadas al esquema simplificado.
// El resto de las paginas del CannTrace original quedan en src/pages por si
// se adaptan mas adelante, pero fuera del router.
// Plantas, Geneticas, Linea de tiempo y Sala viven adentro de esta.
// El módulo Instalación (hardware DIY, riego, tablero, faltantes) tampoco forma
// parte de esta instalación. Ojo: "Econometría › Instalaciones" es otra cosa —el
// equipamiento que amortiza— y sí sigue.
const PaginaAgronomico = lazyWithRetry(() => import('./pages/PaginaAgronomico'), 'PaginaAgronomico')
const PaginaTablas = lazyWithRetry(() => import('./pages/PaginaTablas'), 'PaginaTablas')
const PaginaManual = lazyWithRetry(() => import('./pages/PaginaManual'), 'PaginaManual')
const PaginaEstadisticas = lazyWithRetry(() => import('./pages/PaginaEstadisticas'), 'PaginaEstadisticas')
const PaginaEconometria = lazyWithRetry(() => import('./pages/PaginaEconometria'), 'PaginaEconometria')
const PaginaHistoriaPlanta = lazyWithRetry(() => import('./pages/PaginaHistoriaPlanta'), 'PaginaHistoriaPlanta')
// La Calculadora de Fertilizantes no forma parte de esta instalación: se sacó
// del router y del menú a pedido de la asociación. Los archivos de `components/nutrientes/`
// siguen en el repo, pero al no importarse acá no entran al bundle.
//
// `lib/nutrientes.ts` tampoco entra ya. Econometría lo usaba por `faltantesService`
// para el escenario "si compro lo que falta", pero ese escenario mandaba a la
// pantalla de Insumos faltantes, que es del módulo Instalación y acá no existe.
// Al sacarlo, el único importador que queda es esa misma pantalla, sin ruta.
const PaginaONG = lazyWithRetry(() => import('./pages/PaginaONG'), 'PaginaONG')
const PaginaSumate = lazyWithRetry(() => import('./pages/PaginaSumate'), 'PaginaSumate')
const PaginaMiSolicitud = lazyWithRetry(() => import('./pages/PaginaMiSolicitud'), 'PaginaMiSolicitud')
const Pagina404 = lazyWithRetry(() => import('./pages/Pagina404'), 'Pagina404')

function SpinnerCarga({ texto }: { texto: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-900 border-t-primary-400 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-surface-500">{texto}</p>
      </div>
    </div>
  )
}

function RutaRaiz() {
  const { autenticado, cargando } = useAuth()
  if (cargando) return <SpinnerCarga texto="Cargando..." />
  if (!autenticado) return <Navigate to="/login" replace />
  return <Layout />
}

function App() {
  const { login, autenticado, cargando } = useAuth()
  const [desbloqueado, setDesbloqueado] = useState(estaDesbloqueado())
  const [debeDefinirClave, setDebeDefinirClave] = useState(LLEGO_POR_ENLACE)

  if (cargando) return <SpinnerCarga texto="Iniciando..." />

  // Quien llega por una invitación entra CON SESION y SIN CONTRASEÑA: si no se
  // le pide una acá, entra esta vez y no puede volver a entrar nunca, porque no
  // hay clave con la cual. Va antes del PIN —que es un candado local de este
  // teléfono— porque sin contraseña no hay cuenta que proteger todavía.
  if (autenticado && debeDefinirClave) {
    return <PaginaClave onListo={() => setDebeDefinirClave(false)} />
  }

  // Si hay sesion + PIN configurado, pedir PIN antes de mostrar la app
  if (autenticado && tienePin() && !desbloqueado) {
    return <PinLock modo="verificar" onListo={() => setDesbloqueado(true)} />
  }

  return (
    <ErrorBoundary>
    <ConfirmProvider>
    <Toaster richColors position="top-right" closeButton theme="dark" />
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={autenticado ? <Navigate to="/" replace /> : <PaginaLogin onLogin={login} />}
        />
        {/* PUBLICA, fuera de RutaRaiz: es el link que va en la bio de Instagram
            y lo abre gente que todavia no es socia, o sea que no tiene usuario.
            Adentro de RutaRaiz caeria en el login, que es justo lo contrario de
            lo que se busca. No lee ni escribe datos: solo muestra los pasos. */}
        <Route path="/sumate" element={
          <Suspense fallback={null}><PaginaSumate /></Suspense>
        } />
        {/* El link propio de cada solicitud. Publica por lo mismo: la abre
            alguien que todavia no es socio. Lo que muestra sale de una funcion
            de la base que devuelve UNA solicitud a quien tenga su token. */}
        <Route path="/sumate/:token" element={
          <Suspense fallback={null}><PaginaMiSolicitud /></Suspense>
        } />
        <Route path="/" element={<RutaRaiz />}>
          <Route index element={<PaginaPanel />} />
          {/* AGRONOMICO: seis vistas de lo mismo bajo un solo item de menu.
              La planta, lo que da y el aire donde lo da. Las rutas viejas se
              conservan TODAS —`/cultivo`, `/cosecha` y `/ambiente` incluidas—
              porque estan en links del manual, en las acciones del catalogo y
              en lo que la gente tenga guardado. La seccion sale del pathname.

              CADA RUTA CONSERVA SU PROPIO PERMISO y no se unifican bajo
              `ver_cultivo`: hoy los tres van juntos en todos los roles, pero
              atarlos dejaria que manana alguien con `ver_cosecha` y sin
              `ver_cultivo` se quede sin su pantalla. `PaginaAgronomico` filtra
              las pestanas con el mismo criterio. */}
          {['agronomico', 'cultivo', 'plantas', 'geneticas', 'linea-tiempo', 'sala', 'plan'].map(r => (
            <Route key={r} path={r} element={
              <RutaConPermiso permiso="ver_cultivo"><Suspense fallback={null}><PaginaAgronomico /></Suspense></RutaConPermiso>
            } />
          ))}
          {/* El registro de pacientes es una pestana de O.N.G.: el cupo
              REPROCANN, las dispensas y los documentos cuelgan de el.

              `ong/:tab` existe para poder linkear a una pestaña puntual. Antes
              la pestaña era estado del componente y no se podia mandar a nadie a
              «La entidad»: habia que decirle que entrara a O.N.G. y la buscara
              entre dieciocho. Tampoco andaba el boton atras ni sobrevivia a un
              F5. Con ruta propia, Coherencia puede llevarte al formulario que
              apaga cada cruce. */}
          {/* `ong/*` y no `ong` + `ong/:tab`.
              Eran DOS `<Route>` distintas para la misma pantalla, asi que pasar
              de `/ong` a `/ong/dispensas` desmontaba y volvia a montar
              `PaginaONG` — y con ella su `cargar()`, que trae la base entera.
              Medido en produccion el 29/08/2026: abrir la O.N.G. costaba 41
              consultas y CADA cambio de pestania sumaba entre 33 y 36 mas.
              Con el splat las dos URLs caen en la misma ruta y el componente no
              se remonta: la pestania pasa a ser lo que siempre fue, un cambio
              de vista adentro de la misma pantalla. */}
          {['ong/*', 'registro'].map(r => (
            <Route key={r} path={r} element={
              <RutaConPermiso permiso="ver_ong"><Suspense fallback={null}><PaginaONG /></Suspense></RutaConPermiso>
            } />
          ))}
          {/* El inventario es parte del costo: Stock vive dentro de Econometria. */}
          {['econometria', 'stock'].map(r => (
            <Route key={r} path={r} element={
              <RutaConPermiso permiso="ver_econometria"><Suspense fallback={null}><PaginaEconometria /></Suspense></RutaConPermiso>
            } />
          ))}
          <Route path="manual" element={
            <Suspense fallback={null}><PaginaManual /></Suspense>
          } />
          <Route path="tablas" element={
            <RutaConPermiso permiso="ver_tablas"><Suspense fallback={null}><PaginaTablas /></Suspense></RutaConPermiso>
          } />
          <Route path="cosecha" element={
            <RutaConPermiso permiso="ver_cosecha"><Suspense fallback={null}><PaginaAgronomico /></Suspense></RutaConPermiso>
          } />
          <Route path="stats" element={
            <RutaConPermiso permiso="ver_estadisticas"><Suspense fallback={null}><PaginaEstadisticas /></Suspense></RutaConPermiso>
          } />
          <Route path="ambiente" element={
            <RutaConPermiso permiso="ver_ambiente"><Suspense fallback={null}><PaginaAgronomico /></Suspense></RutaConPermiso>
          } />
          {/* La ficha que se abre al escanear el QR de una planta: sigue el
              permiso de cultivo, o la demo veria una planta real por la URL. */}
          <Route path="p/:codigo" element={
            <RutaConPermiso permiso="ver_cultivo"><Suspense fallback={null}><PaginaHistoriaPlanta /></Suspense></RutaConPermiso>
          } />
        </Route>
        <Route path="*" element={<Suspense fallback={<SpinnerCarga texto="Cargando..." />}><Pagina404 /></Suspense>} />
      </Routes>
    </BrowserRouter>
    </ConfirmProvider>
    </ErrorBoundary>
  )
}

export default App
