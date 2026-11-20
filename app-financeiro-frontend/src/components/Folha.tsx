import { useEffect, useId } from "react";
import { X } from "lucide-react";

interface Props {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  largura?: "md" | "lg";
  children: React.ReactNode;
  rodape?: React.ReactNode;
}

/**
 * Janela usada por todos os modais.
 * No celular sobe de baixo ocupando a largura toda (fácil de alcançar com o polegar);
 * a partir de 640px vira uma janela centralizada.
 */
export default function Folha({ titulo, subtitulo, onClose, largura = "md", children, rodape }: Props) {
  const idTitulo = useId();

  useEffect(() => {
    const aoApertar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", aoApertar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // a página de trás não rola junto
    return () => {
      document.removeEventListener("keydown", aoApertar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-[#04100f]/70 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`folha relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-b-0 border-borda bg-painel shadow-[0_-12px_40px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:border-b ${largura === "lg" ? "sm:max-w-lg" : "sm:max-w-md"}`}
      >
        {/* alça visual de "folha" no celular */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-borda-forte sm:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0">
            <h2 id={idTitulo} className="font-display text-xl font-semibold tracking-tight text-texto">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-apagado first-letter:uppercase">{subtitulo}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="-mr-2 rounded-full p-2.5 text-suave transition-colors hover:bg-painel-2 hover:text-texto">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {rodape && <div className="pb-seguro shrink-0 border-t border-borda px-5 pt-3 sm:pb-4">{rodape}</div>}
        {!rodape && <div className="pb-seguro shrink-0 sm:hidden" />}
      </div>
    </div>
  );
}
