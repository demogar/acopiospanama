/** Tipografía de las páginas de texto (Cómo funciona, Privacidad). */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 font-text text-[1.0625rem] leading-relaxed text-ink [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_h2]:font-ui [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-snug [&_li]:ms-5 [&_li]:list-disc [&_li]:ps-1 [&_section]:grid [&_section]:gap-2 [&_strong]:font-semibold [&_ul]:grid [&_ul]:gap-1.5">
      {children}
    </div>
  );
}
