import { PageHeader } from "../components/ui/page-header";

export default function Home() {
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const titulo = `Hoje, ${hoje.replace("-feira, ", " ")}`;

  return (
    <PageHeader title={titulo}>
      <p className="max-w-prose text-ink-2">
        Registre seu primeiro gasto ou marque um compromisso.
      </p>
    </PageHeader>
  );
}
