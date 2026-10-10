"use client";

import { useEffect, useRef, useState } from "react";
import type { GruposResposta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { PageHeader } from "../../components/ui/page-header";
import { PendingAction } from "../../components/ui/pending-action";
import { cn, focusRing } from "../../components/ui/cn";

type Group = GruposResposta["groups"][number];
type Session = GruposResposta["sessions"][number];
type RascunhoGrupo = { id: string | null; name: string; description: string };
type RascunhoSessao = {
  id: string | null;
  name: string;
  description: string;
  justification: string;
  groupId: string;
  escolherGrupo: boolean;
};
type Sugestao = {
  titulo: string;
  texto: string;
  nome: string;
  descricao: string;
  estado: "open" | "done" | "gone";
};

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 grid max-h-dvh w-full min-w-0 max-w-none gap-4 overflow-y-auto rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-md tab:rounded-lg";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function sessionCountLabel(count: number) {
  if (count === 1) return "1 sessão";
  return `${count} sessões`;
}

function texto(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || "Sem descrição";
}

function inicioDaSessao(iso: string | null) {
  if (!iso) return "";
  const data = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return "";
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(data);
  return `Início em ${mes} de ${data.getUTCFullYear()}`;
}

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export default function Grupos() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [groupDraft, setGroupDraft] = useState<RascunhoGrupo | null>(null);
  const [sessionDraft, setSessionDraft] = useState<RascunhoSessao | null>(null);
  const [groupError, setGroupError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionHint, setSessionHint] = useState("");
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [busca, setBusca] = useState("");
  const groupDialog = useRef<HTMLDialogElement>(null);
  const sessionDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    api<GruposResposta>("/api/grupos")
      .then((data) => {
        if (!active) return;
        setGroups(data.groups);
        setSessions(data.sessions.filter((session) => !session.endedAt));
      })
      .catch((error: Error) => {
        if (!active) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const dialog = groupDialog.current;
    if (!dialog) return;
    if (groupDraft && !dialog.open) dialog.showModal();
    if (!groupDraft && dialog.open) dialog.close();
  }, [groupDraft]);

  useEffect(() => {
    const dialog = sessionDialog.current;
    if (!dialog) return;
    if (sessionDraft && !dialog.open) dialog.showModal();
    if (!sessionDraft && dialog.open) dialog.close();
  }, [sessionDraft]);

  function sessionsOf(groupId: string) {
    return sessions.filter((session) => session.groupId === groupId);
  }

  const termo = normalizar(busca.trim());

  function inclui(value: string | undefined) {
    return normalizar(value ?? "").includes(termo);
  }

  const visiveis = groups.flatMap((group) => {
    const sessoes = sessionsOf(group.id);
    if (!termo) return [{ group, sessions: sessoes }];
    const grupoCombina = inclui(group.name) || inclui(group.description);
    if (grupoCombina) return [{ group, sessions: sessoes }];
    const sessoesFiltradas = sessoes.filter(
      (session) =>
        inclui(session.name) || inclui(session.description) || inclui(session.justification),
    );
    return sessoesFiltradas.length > 0 ? [{ group, sessions: sessoesFiltradas }] : [];
  });

  function openGroup(group?: Group) {
    setSessionHint("");
    setGroupError("");
    setGroupDraft({
      id: group?.id ?? null,
      name: group?.name ?? "",
      description: group?.description ?? "",
    });
  }

  function openSession(
    groupId = "",
    session?: Session,
    escolherGrupo = false,
    prefill?: { name: string; description: string },
  ) {
    if (!session && !prefill && !groupId && groups.length === 0) {
      setSessionHint("Crie um grupo antes da sessão.");
      return;
    }
    setSessionHint("");
    setSessionError("");
    const unico = groups.length === 1 ? groups[0] : undefined;
    setSessionDraft({
      id: session?.id ?? null,
      name: session?.name ?? prefill?.name ?? "",
      description: session?.description ?? prefill?.description ?? "",
      justification: session?.justification ?? "",
      groupId: session?.groupId || groupId || (escolherGrupo ? (unico?.id ?? "") : ""),
      escolherGrupo,
    });
  }

  function toggle(id: string) {
    setClosed((current) => ({ ...current, [id]: !current[id] }));
  }

  async function saveGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!groupDraft) return;
    const name = groupDraft.name.trim();
    const description = groupDraft.description.trim();
    if (!name) {
      setGroupError("Dê um nome ao grupo.");
      return;
    }
    try {
      const group = groupDraft.id
        ? await api<Group>(`/api/grupos/${groupDraft.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name, description }),
          })
        : await api<Group>("/api/grupos", {
            method: "POST",
            body: JSON.stringify({ id: crypto.randomUUID(), name, description }),
          });
      setGroups((current) => {
        const next = current.filter((item) => item.id !== group.id);
        return [...next, group].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });
      setGroupDraft(null);
      setLoadError("");
      setSessionHint("");
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function saveSession(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionDraft) return;
    const name = sessionDraft.name.trim();
    const description = sessionDraft.description.trim();
    const justification = sessionDraft.justification.trim();
    const groupId = sessionDraft.groupId;
    if (!name) {
      setSessionError("Dê um nome à sessão.");
      return;
    }
    if (!groupId) {
      setSessionError("Escolha um grupo.");
      return;
    }
    const corpo = { name, description, justification, groupId };
    try {
      const session = sessionDraft.id
        ? await api<Session>(`/api/sessoes/${sessionDraft.id}`, {
            method: "PATCH",
            body: JSON.stringify(corpo),
          })
        : await api<Session>("/api/sessoes", {
            method: "POST",
            body: JSON.stringify({
              id: crypto.randomUUID(),
              cents: 0,
              ...corpo,
            }),
          });
      setSessions((current) => {
        const next = current.filter((item) => item.id !== session.id);
        return [...next, session].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });
      setSessionDraft(null);
      setLoadError("");
      if (sugestao?.estado === "open" && sugestao.nome === name) {
        setSugestao({ ...sugestao, estado: "done" });
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function removeGroup(id: string) {
    try {
      await api<void>(`/api/grupos/${id}`, { method: "DELETE" });
      setGroups((current) => current.filter((group) => group.id !== id));
      setSessions((current) => current.filter((session) => session.groupId !== id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function removeSession(id: string) {
    try {
      await api<void>(`/api/sessoes/${id}`, { method: "DELETE" });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  function preencherSugestao(escolherGrupo: boolean) {
    if (!sugestao) return;
    if (groups.length === 0) {
      setSessionHint("Crie um grupo antes da sessão.");
      return;
    }
    const unico = groups.length === 1 ? groups[0] : undefined;
    openSession(unico && !escolherGrupo ? unico.id : "", undefined, escolherGrupo || !unico, {
      name: sugestao.nome,
      description: sugestao.descricao,
    });
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
    <PageHeader
      title="Sessões e grupos"
      subtitle="Defina onde seus lançamentos serão acumulados."
      actions={
        <>
          <Button onClick={() => openGroup()}>Novo grupo</Button>
          <Button variant="primary" onClick={() => openSession("", undefined, true)}>
            Nova sessão
          </Button>
        </>
      }
    >
      <div className="grid min-w-0 gap-6">
        {loadError ? (
          <p role="alert" className="min-w-0 max-w-prose text-sm text-neg">
            {loadError}
          </p>
        ) : null}
        {sessionHint ? (
          <p className="min-w-0 max-w-prose text-sm text-ink-2">{sessionHint}</p>
        ) : null}
        {!ready ? (
          <p role="status" className="min-w-0 max-w-prose text-sm text-ink-2">
            Carregando grupos.
          </p>
        ) : null}
        {ready && !loadError && groups.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-ink-2">
            Nenhum grupo ainda.
          </p>
        ) : null}
        {ready && !loadError && groups.length > 0 ? (
          <input
            type="search"
            aria-label="Buscar grupo ou sessão"
            placeholder="Buscar grupo ou sessão"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className={field}
          />
        ) : null}
        {sugestao ? (
          <PendingAction state={sugestao.estado} title={sugestao.titulo}>
            {sugestao.estado === "open" ? (
              <>
                <p className="text-sm">{sugestao.texto}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => preencherSugestao(false)}>
                    Criar sessão
                  </Button>
                  <Button onClick={() => preencherSugestao(true)}>Editar</Button>
                  <Button
                    variant="quiet"
                    onClick={() => setSugestao({ ...sugestao, estado: "gone" })}
                  >
                    Descartar
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-2">
                {sugestao.estado === "done" ? "Sessão criada" : "Sugestão descartada"}
              </p>
            )}
          </PendingAction>
        ) : null}
        {ready && !loadError && groups.length > 0 && visiveis.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-ink-2">
            Nenhum grupo ou sessão encontrado.
          </p>
        ) : null}
        {visiveis.map(({ group, sessions: sessoesVisiveis }) => (
          <GroupCard
            key={group.id}
            group={group}
            sessions={sessoesVisiveis}
            closed={termo ? false : (closed[group.id] ?? false)}
            onToggle={() => toggle(group.id)}
            onEdit={() => openGroup(group)}
            onAdd={() => openSession(group.id)}
            onEditSession={(session) => openSession(session.groupId, session)}
            onMoveSession={(session) => openSession(session.groupId, session, true)}
            onRemove={() => removeGroup(group.id)}
            onRemoveSession={removeSession}
          />
        ))}
      </div>

      <dialog
        ref={groupDialog}
        className={dialogClass}
        aria-labelledby="titulo-grupo"
        onClose={() => setGroupDraft(null)}
      >
        <h2 id="titulo-grupo" className="font-display text-lg">
          {groupDraft?.id ? "Editar grupo" : "Novo grupo"}
        </h2>
        <form className="grid gap-4" onSubmit={saveGroup}>
          <div className="grid gap-1">
            <label htmlFor="grupo-nome" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="grupo-nome"
              value={groupDraft?.name ?? ""}
              maxLength={60}
              placeholder="Ex.: Transporte"
              onChange={(event) =>
                setGroupDraft((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              className={field}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="grupo-descricao" className="text-sm font-medium">
              Descrição <span className="font-normal text-ink-2">(opcional)</span>
            </label>
            <textarea
              id="grupo-descricao"
              value={groupDraft?.description ?? ""}
              maxLength={160}
              rows={3}
              placeholder="Ex.: Combustível, aplicativos e manutenção do carro."
              onChange={(event) =>
                setGroupDraft((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
              className={`${field} resize-y py-3`}
            />
            <p className="text-xs text-ink-2">
              Até 160 caracteres. Grupos só organizam sessões; os lançamentos entram nas sessões.
            </p>
          </div>
          {groupError ? (
            <p role="alert" className="text-sm text-neg">
              {groupError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="quiet" onClick={() => setGroupDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {groupDraft?.id ? "Salvar grupo" : "Criar grupo"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={sessionDialog}
        className={dialogClass}
        aria-labelledby="titulo-sessao"
        onClose={() => setSessionDraft(null)}
      >
        <h2 id="titulo-sessao" className="font-display text-lg">
          {sessionDraft?.id
            ? sessionDraft.escolherGrupo
              ? "Mover sessão"
              : "Editar sessão"
            : "Nova sessão"}
        </h2>
        <form className="grid gap-4" onSubmit={saveSession}>
          <div className="grid gap-1">
            <label htmlFor="sessao-nome" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="sessao-nome"
              value={sessionDraft?.name ?? ""}
              maxLength={60}
              placeholder="Ex.: Mercado"
              onChange={(event) =>
                setSessionDraft((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              className={field}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="sessao-descricao" className="text-sm font-medium">
              Descrição <span className="font-normal text-ink-2">(opcional)</span>
            </label>
            <textarea
              id="sessao-descricao"
              value={sessionDraft?.description ?? ""}
              maxLength={160}
              rows={3}
              placeholder="Ex.: Compras de supermercado, feira e padaria."
              onChange={(event) =>
                setSessionDraft((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
              className={`${field} resize-y py-3`}
            />
            <p className="text-xs text-ink-2">
              Até 160 caracteres. A IA usa a descrição no contexto da sessão.
            </p>
          </div>
          <div className="grid gap-1">
            <label htmlFor="sessao-justificativa" className="text-sm font-medium">
              Justificativa <span className="font-normal text-ink-2">(opcional)</span>
            </label>
            <textarea
              id="sessao-justificativa"
              value={sessionDraft?.justification ?? ""}
              maxLength={160}
              rows={3}
              placeholder="Ex.: Reserva mensal para o mercado da casa."
              onChange={(event) =>
                setSessionDraft((current) =>
                  current ? { ...current, justification: event.target.value } : current,
                )
              }
              className={`${field} resize-y py-3`}
            />
            <p className="text-xs text-ink-2">
              Até 160 caracteres. A IA usa a justificativa no contexto da sessão.
            </p>
          </div>
          {sessionDraft?.escolherGrupo ? (
            <div className="grid gap-1">
              <label htmlFor="sessao-grupo" className="text-sm font-medium">
                Grupo
              </label>
              <select
                id="sessao-grupo"
                required
                value={sessionDraft.groupId}
                onChange={(event) =>
                  setSessionDraft((current) =>
                    current ? { ...current, groupId: event.target.value } : current,
                  )
                }
                className={field}
              >
                <option value="">Escolha um grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {sessionError ? (
            <p role="alert" className="text-sm text-neg">
              {sessionError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="quiet" onClick={() => setSessionDraft(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {sessionDraft?.id
                ? sessionDraft.escolherGrupo
                  ? "Mover sessão"
                  : "Salvar sessão"
                : "Criar sessão"}
            </Button>
          </div>
        </form>
      </dialog>
    </PageHeader>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: "add" | "edit" | "remove";
}) {
  return (
    <Button variant="quiet" className="size-10 px-0" aria-label={label} onClick={onClick}>
      <Icone name={icon} />
    </Button>
  );
}

function Icone({ name }: { name: "add" | "edit" | "remove" }) {
  const comum = {
    viewBox: "0 0 24 24",
    className: "size-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true as const,
  };
  if (name === "add") {
    return (
      <svg {...comum}>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "edit") {
    return (
      <svg {...comum}>
        <path d="M4 20h4L18 10l-4-4L4 16v4z" strokeLinejoin="round" />
        <path d="M13 6l4 4" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <path d="M5 7h14" strokeLinecap="round" />
      <path d="M9 7V5h6v2" strokeLinejoin="round" />
      <path d="M8 7l1 12h6l1-12" strokeLinejoin="round" />
    </svg>
  );
}

function GroupCard({
  group,
  title,
  description,
  sessions,
  closed,
  onToggle,
  onEdit,
  onAdd,
  onEditSession,
  onMoveSession,
  onRemove,
  onRemoveSession,
  bodyId,
  headingId,
}: {
  group?: Group;
  title?: string;
  description?: string;
  sessions: Session[];
  closed: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onAdd?: () => void;
  onEditSession: (session: Session) => void;
  onMoveSession: (session: Session) => void;
  onRemove?: () => void;
  onRemoveSession: (id: string) => void;
  bodyId?: string;
  headingId?: string;
}) {
  const name = group?.name ?? title ?? "";
  const detail = group?.description ?? description ?? "";
  const id = headingId ?? group?.id ?? "grupo";
  const panelId = bodyId ?? `${id}-body`;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby={id}>
      <div className="grid gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 tab:flex-nowrap">
          <h2 id={id} className="w-full min-w-0 font-display text-lg tab:w-auto tab:flex-1">
            <button
              type="button"
              className={`flex min-h-10 w-full min-w-0 items-center gap-3 bg-transparent text-left tab:w-auto ${focusRing}`}
              aria-expanded={!closed}
              aria-controls={panelId}
              onClick={onToggle}
            >
              <span
                className={cn(
                  "size-2 shrink-0 border-r-2 border-b-2 border-ink-2 transition-transform duration-150 motion-reduce:transition-none",
                  closed ? "-rotate-45" : "rotate-45",
                )}
              />
              <span className="min-w-0 truncate">{name}</span>
              <Chip className="shrink-0 font-sans font-normal">
                {sessionCountLabel(sessions.length)}
              </Chip>
            </button>
          </h2>
          {onEdit || (onAdd && sessions.length > 0) || onRemove ? (
            <div className="flex flex-wrap gap-2">
              {onEdit ? <IconButton label="Editar grupo" onClick={onEdit} icon="edit" /> : null}
              {onAdd && sessions.length > 0 ? (
                <IconButton label="Adicionar sessão" onClick={onAdd} icon="add" />
              ) : null}
              {onRemove ? (
                <IconButton label="Remover grupo" onClick={onRemove} icon="remove" />
              ) : null}
            </div>
          ) : null}
        </div>
        <p
          className={cn(
            "flex gap-3 text-sm text-ink-2",
            detail.trim() ? "" : "opacity-75",
          )}
        >
          <span className="size-2 shrink-0" aria-hidden="true" />
          <span className="min-w-0 max-w-prose line-clamp-2">{texto(detail)}</span>
        </p>
      </div>
      <div id={panelId} hidden={closed}>
        {sessions.length === 0 ? (
          <div className="flex gap-3 border-t border-line px-4 py-6 text-sm text-ink-2">
            <span className="size-2 shrink-0" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
              <span className="max-w-prose">
                Nenhuma sessão neste grupo. Crie a primeira para começar a organizar.
              </span>
              {onAdd ? <Button onClick={onAdd}>Adicionar sessão</Button> : null}
            </div>
          </div>
        ) : (
          <ul className="border-t border-line">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex min-w-0 gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="size-2 shrink-0" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-3 tab:flex-row tab:items-start tab:justify-between">
                  <div className="grid min-w-0 gap-1">
                    <div className="font-medium">{session.name}</div>
                    <p
                      className={cn(
                        "max-w-prose text-sm text-ink-2 line-clamp-2",
                        (session.description ?? "").trim() ? "" : "opacity-75",
                      )}
                    >
                      {texto(session.description)}
                    </p>
                    {session.justification.trim() ? (
                      <p className="max-w-prose text-sm text-ink-2 line-clamp-2">
                        <span className="font-medium">Justificativa: </span>
                        {session.justification}
                      </p>
                    ) : null}
                    {inicioDaSessao(session.startedAt) ? (
                      <p className="text-sm text-ink-2">{inicioDaSessao(session.startedAt)}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <IconButton
                      label="Editar sessão"
                      onClick={() => onEditSession(session)}
                      icon="edit"
                    />
                    <Button variant="quiet" onClick={() => onMoveSession(session)}>
                      Mover
                    </Button>
                    <IconButton
                      label="Remover sessão"
                      onClick={() => onRemoveSession(session.id)}
                      icon="remove"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
