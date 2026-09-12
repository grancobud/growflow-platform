// PaginaSumate — la unica pantalla PUBLICA de la app.
//
// Es la que va en la bio de Instagram. Hoy ahi hay tres links sueltos y quien
// entra no sabe cual va primero, si son alternativas o si hay que hacer los
// tres. Aca estan en orden, con una linea que dice para que es cada uno.
//
// Va FUERA de RutaRaiz a proposito: todo lo demas de la app exige login, y una
// persona que todavia no es socia obviamente no tiene usuario. Si esta pantalla
// quedara adentro, el link de Instagram llevaria a la pantalla de login, que es
// exactamente lo que no queremos.
//
// DESDE EL 22/08/2026 SI ESCRIBE: el formulario crea una solicitud de alta.
// Es la unica escritura publica del sistema, y no toca la tabla directamente
// sino la funcion `solicitud_crear` de la base: `anon` no tiene ni un permiso
// sobre `ong_solicitudes`.
//
// Sigue sin LEER nada de nadie. Lo unico que devuelve es el token de la
// solicitud que acaba de crear quien lo pide, y con ese token no se llega a
// ningun otro dato del sistema.

import { Marca } from '../components/Marca'
import { FormularioSolicitud } from '../components/ong/FormularioSolicitud'
import { WHATSAPP, linkWhatsapp } from '../lib/altaSocios'

export default function PaginaSumate() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center">
          <Marca tamano="lg" centrado />
          <h1 className="mt-6 font-display font-bold tracking-tight text-[22px] sm:text-[26px] text-[#ececf1]">
            Cómo sumarte
          </h1>
          <p className="mt-2.5 text-[13px] text-[#a6a6b5] leading-relaxed">
            Completá el formulario de acá abajo para iniciar tu legajo de admisión.
            La vinculación en REPROCANN es el requisito que formaliza el ingreso al
            programa de cultivo y dispensa, y la hacemos con vos: no es un filtro
            para entrar.
          </p>
        </header>

        <div className="mt-8">
          <FormularioSolicitud />
        </div>

        {/* EL CIERRE DEL FORMULARIO, y es lo único que va acá.
            Antes esta sección explicaba el trámite del REPROCANN en tres pasos.
            la asociación la sacó: esa charla la dan presencialmente en la primera
            visita, y acá lo que hacía era alargar una pantalla cuyo único
            objetivo es que la persona escriba para coordinar.
            El botón va DESPUÉS del formulario a propósito: el mensaje dice que
            ya lo completó, así que ofrecerlo antes invita a mandarlo sin haberlo
            hecho. */}
        <section className="mt-8 rounded-xl border border-[#a3e635]/25 bg-[#a3e635]/[0.06] p-4 text-center">
          <h2 className="text-[13px] font-medium text-[#ececf1]">Siguiente paso</h2>
          <p className="mt-1.5 text-[12px] text-[#a6a6b5] leading-relaxed">
            Escribinos para agendar tu visita a la sede. Ahí hacemos el resto del
            trámite con vos.
          </p>
          <a href={linkWhatsapp()} target="_blank" rel="noopener noreferrer"
            className="mt-3.5 w-full inline-flex items-center justify-center gap-2 text-[13px] text-[#07070b] bg-[#a3e635] hover:bg-[#bef264] rounded-lg px-3 py-3 min-h-[44px] font-medium transition-colors">
            Escribinos por WhatsApp
          </a>
          {/* El numero en texto tambien: no todo el mundo abre WhatsApp desde el
              navegador, y alguien puede querer guardarlo o llamar. */}
          <p className="mt-2.5 text-[11px] text-[#8a8a9c] leading-relaxed">
            {WHATSAPP.visible} · {WHATSAPP.atencion}
          </p>
        </section>

        <footer className="mt-8 text-center text-[10px] text-[#8a8a9c]">
          la asociación · Cannabis y Derechos
        </footer>
      </div>
    </div>
  )
}
