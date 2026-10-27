"use client";

import { Chip } from "../ui/chip";
import { cn } from "../ui/cn";
import { Money } from "../ui/money";
import { ItemAnimado, ListaAnimada } from "../ui/movimento";
import { PendingAction } from "../ui/pending-action";
import { Stat } from "../ui/stat";

const garantias = [
  "Cada conta enxerga só os próprios dados",
  "Senha guardada com scrypt, nunca em texto",
  "Sessão em cookie httpOnly, que o navegador não deixa o JavaScript ler",
];

export function Marca({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-display text-lg font-bold tracking-titulo text-ink", className)}>
      <span aria-hidden className="size-3 shrink-0 bg-cta" />
      Prumo
    </div>
  );
}

function Linha({ evento = false, children }: { evento?: boolean; children: React.ReactNode }) {
  return (
    <ItemAnimado
      className={cn(
        "flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
        evento && "border-l-4 border-l-event",
      )}
    >
      {children}
    </ItemAnimado>
  );
}

/** Lado esquerdo da tela de acesso: o que o produto faz, com um mês de exemplo. Só aparece a partir de 1100 px. */
export function PainelDaMarca() {
  return (
    <aside
      aria-label="Sobre o Prumo"
      className="pontos hidden min-w-0 flex-col justify-between gap-8 overflow-y-auto border-r border-line bg-bg px-12 py-8 desk:sticky desk:top-0 desk:flex desk:h-dvh"
    >
      <Marca />

      <div className="grid max-w-prose gap-8">
        <div className="grid gap-4">
          <p className="etiqueta text-brand">Agenda e finanças</p>
          <p className="font-display text-2xl font-bold tracking-titulo">Seu dia e seu dinheiro, no mesmo lugar.</p>
          <p className="max-w-prose text-ink-2">
            Compromissos e lançamentos lado a lado. O assistente sugere, você confirma.
          </p>
        </div>

        <figure className="grid border border-line bg-surface">
          <figcaption className="etiqueta flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3 text-ink-2">
            Outubro
            <Chip>Exemplo</Chip>
          </figcaption>
          <dl className="grid grid-cols-3 gap-4 border-b border-line p-4">
            <Stat label="Entradas">
              <Money cents={620000} />
            </Stat>
            <Stat label="Saídas">
              <Money cents={-238000} />
            </Stat>
            <Stat label="Saldo">
              <Money cents={382000} />
            </Stat>
          </dl>
          <ListaAnimada className="grid">
            <Linha>
              <span className="min-w-0 flex-1 font-medium">Aluguel</span>
              <Chip>Fixa</Chip>
              <Money cents={-180000} />
            </Linha>
            <Linha>
              <span className="min-w-0 flex-1 font-medium">Mercado</span>
              <Chip>Avulsa</Chip>
              <Money cents={-58000} />
            </Linha>
            <Linha evento>
              <span className="min-w-0 flex-1 font-medium">Dentista, 15h</span>
              <Chip>Compromisso</Chip>
            </Linha>
          </ListaAnimada>
          <div className="border-t border-line p-4">
            <PendingAction title="Mercado em Alimentação">
              <p className="text-sm text-ink-2">Categoria sugerida a partir do seu extrato.</p>
            </PendingAction>
          </div>
        </figure>
      </div>

      <ul className="grid gap-3">
        {garantias.map((texto) => (
          <li key={texto} className="flex items-center gap-3 text-sm text-ink-2">
            <span aria-hidden className="size-2 shrink-0 bg-brand" />
            {texto}
          </li>
        ))}
      </ul>
    </aside>
  );
}
