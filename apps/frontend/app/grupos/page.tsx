"use client";

import { useEffect, useState } from "react";
import type { GruposResposta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { List } from "../../components/ui/list";
import { ListRow } from "../../components/ui/list-row";
import { Money } from "../../components/ui/money";
import { PageHeader } from "../../components/ui/page-header";
import { focusRing } from "../../components/ui/cn";

type Group = GruposResposta["groups"][number];
type Session = GruposResposta["sessions"][number];

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;

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
  if (count === 0) return "Nenhuma sessão";
  if (count === 1) return "1 sessão";
  return `${count} sessões`;
}

function centavosDe(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "").replace(/r\$/gi, "").replace("−", "-");
  if (!text) return null;
  const match = /^([+-])?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = match[2].replace(/\./g, "");
  if (whole.length > 8) return null;
  const fraction = (match[3] ?? "00").padEnd(2, "0");
  const cents = (match[1] === "-" ? -1 : 1) * (Number(whole) * 100 + Number(fraction));
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 2_147_483_647) return null;
  return cents;
}

export default function Grupos() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ready, setReady] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionAmount, setSessionAmount] = useState("");
  const [sessionGroupId, setSessionGroupId] = useState("");
  const [groupError, setGroupError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const sessionCents = centavosDe(sessionAmount);

  useEffect(() => {
    let active = true;
    api<GruposResposta>("/api/grupos")
      .then((data) => {
        if (!active) return;
        setGroups(data.groups);
        setSessions(data.sessions);
        setSessionGroupId(data.groups[0]?.id ?? "");
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

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setGroupError("Dê um nome ao grupo.");
      return;
    }
    try {
      const group = await api<Group>("/api/grupos", {
        method: "POST",
        body: JSON.stringify({ id: crypto.randomUUID(), name }),
      });
      setGroups((current) =>
        current.some((item) => item.id === group.id) ? current : [...current, group],
      );
      setSessionGroupId((current) => current || group.id);
      setGroupName("");
      setGroupError("");
      setLoadError("");
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function removeGroup(id: string) {
    try {
      await api<void>(`/api/grupos/${id}`, { method: "DELETE" });
      const remaining = groups.filter((group) => group.id !== id);
      setGroups(remaining);
      setSessions((current) => current.filter((session) => session.groupId !== id));
      setSessionGroupId((current) =>
        current === id ? (remaining[0]?.id ?? "") : current,
      );
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function createSession(event: React.FormEvent) {
    event.preventDefault();
    const name = sessionName.trim();
    if (!sessionGroupId) {
      setSessionError("Crie um grupo antes da sessão.");
      return;
    }
    if (!name) {
      setSessionError("Dê um nome à sessão.");
      return;
    }
    if (sessionCents === null) {
      setSessionError("Informe o valor da sessão.");
      return;
    }
    try {
      const session = await api<Session>("/api/sessoes", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          groupId: sessionGroupId,
          name,
          cents: sessionCents,
        }),
      });
      setSessions((current) =>
        current.some((item) => item.id === session.id) ? current : [...current, session],
      );
      setSessionName("");
      setSessionAmount("");
      setSessionError("");
      setLoadError("");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  async function removeSession(id: string) {
    try {
      await api<void>(`/api/sessoes/${id}`, { method: "DELETE" });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "O backend não respondeu.");
    }
  }

  function groupTotal(id: string) {
    return sessions
      .filter((session) => session.groupId === id)
      .reduce((sum, session) => sum + session.cents, 0);
  }

  return (
    <PageHeader title="Grupos" subtitle="Custos do grupo">
      <div className="grid min-w-0 gap-8">
        {loadError ? <p className="min-w-0 max-w-prose text-ink-2">{loadError}</p> : null}
        {!ready ? <p className="min-w-0 max-w-prose text-ink-2">Carregando grupos.</p> : null}
        <section className="grid min-w-0 gap-3">
          <h2 className="min-w-0 font-display text-lg">Grupos</h2>
          <form className="grid min-w-0 gap-2" onSubmit={createGroup}>
            <label htmlFor="grupo-nome" className="text-sm text-ink-2">
              Nome do grupo
            </label>
            <div className="flex min-w-0 flex-col gap-2 tab:flex-row tab:items-center">
              <input
                id="grupo-nome"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Casa, mercado, viagem"
                className={`${field} tab:w-auto tab:flex-1`}
              />
              <Button type="submit" variant="primary">
                Criar grupo
              </Button>
            </div>
            {groupError ? <p className="min-w-0 text-sm text-ink-2">{groupError}</p> : null}
          </form>
          {ready && !loadError && groups.length === 0 ? (
            <p className="min-w-0 max-w-prose text-ink-2">Nenhum grupo ainda.</p>
          ) : groups.length > 0 ? (
            <List>
              {groups.map((group) => {
                const count = sessions.filter((session) => session.groupId === group.id).length;
                return (
                  <ListRow
                    key={group.id}
                    title={group.name}
                    meta={sessionCountLabel(count)}
                    value={<Money cents={groupTotal(group.id)} />}
                    action={
                      <Button variant="quiet" onClick={() => removeGroup(group.id)}>
                        Remover
                      </Button>
                    }
                  />
                );
              })}
            </List>
          ) : null}
        </section>

        <section className="grid min-w-0 gap-3">
          <h2 className="min-w-0 font-display text-lg">Sessões</h2>
          <p className="min-w-0 max-w-prose text-ink-2">
            Cada sessão é um custo. Menos para saída, como aluguel e conta de água. Sem menos
            para entrada, como salário e hora extra.
          </p>
          {ready ? (
            <form className="grid min-w-0 gap-3" onSubmit={createSession}>
              <div className="grid min-w-0 gap-2">
                <label htmlFor="sessao-nome" className="text-sm text-ink-2">
                  Nome da sessão
                </label>
                <input
                  id="sessao-nome"
                  value={sessionName}
                  onChange={(event) => setSessionName(event.target.value)}
                  placeholder="Aluguel, conta de água, salário"
                  className={field}
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <label htmlFor="sessao-valor" className="text-sm text-ink-2">
                  Valor
                </label>
                <div className="flex min-w-0 flex-col gap-2 tab:flex-row tab:items-center">
                  <input
                    id="sessao-valor"
                    inputMode="decimal"
                    value={sessionAmount}
                    onChange={(event) => setSessionAmount(event.target.value)}
                    placeholder="-1.500,00"
                    className={`${field} tab:w-auto tab:flex-1`}
                  />
                  {sessionCents !== null ? <Money cents={sessionCents} /> : null}
                </div>
              </div>
              <div className="grid min-w-0 gap-2">
                <label htmlFor="sessao-grupo" className="text-sm text-ink-2">
                  Grupo
                </label>
                <select
                  id="sessao-grupo"
                  value={groups.length === 0 ? "" : sessionGroupId}
                  onChange={(event) => setSessionGroupId(event.target.value)}
                  disabled={groups.length === 0}
                  className={field}
                >
                  {groups.length === 0 ? (
                    <option value="">Crie um grupo antes</option>
                  ) : (
                    groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <Button type="submit" variant="primary">
                  Criar sessão
                </Button>
              </div>
              {sessionError ? <p className="min-w-0 text-sm text-ink-2">{sessionError}</p> : null}
              {groups.length === 0 && !sessionError ? (
                <p className="min-w-0 max-w-prose text-ink-2">Crie um grupo antes da sessão.</p>
              ) : null}
            </form>
          ) : null}
          {ready && !loadError && sessions.length === 0 ? (
            <p className="min-w-0 max-w-prose text-ink-2">Nenhuma sessão ainda.</p>
          ) : sessions.length > 0 ? (
            <List>
              {sessions.map((session) => {
                const group = groups.find((item) => item.id === session.groupId);
                return (
                  <ListRow
                    key={session.id}
                    title={session.name}
                    meta={group?.name}
                    value={<Money cents={session.cents} />}
                    action={
                      <Button variant="quiet" onClick={() => removeSession(session.id)}>
                        Remover
                      </Button>
                    }
                  />
                );
              })}
            </List>
          ) : null}
        </section>
      </div>
    </PageHeader>
  );
}
