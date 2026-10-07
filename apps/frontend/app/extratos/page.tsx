"use client";

import { useEffect, useRef, useState } from "react";
import {
  LIMITE_EXTRATO_BYTES,
  STATUS_EXTRATO,
  type Extrato,
  type ExtratosResposta,
  type LinhaExtrato,
  type LinhasExtrato,
  type MapeamentoExtrato,
  type PreviaExtrato,
  type StatusExtrato,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { Money } from "../../components/ui/money";
import { PageHeader } from "../../components/ui/page-header";
import { Stat } from "../../components/ui/stat";

const NOVA = "nova";
const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-lg tab:rounded-lg";
const dialogLinhas =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-3xl tab:rounded-lg";

const ROTULO: Record<StatusExtrato, string> = {
  importado: "Importado",
  com_erros: "Com erros",
  processando: "Processando",
  falhou: "Falhou",
};

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

function base64(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  });
}

function dia(iso: string) {
  const [ano, mes, data] = iso.split("-");
  return `${data}/${mes}/${ano}`;
}

function periodo(extrato: Extrato) {
  if (!extrato.startDate || !extrato.endDate) return "Período aguardando leitura";
  return `${dia(extrato.startDate).slice(0, 5)} – ${dia(extrato.endDate).slice(0, 5)}`;
}

function quando(iso: string) {
  const data = new Date(iso);
  const texto = (valor: number) => String(valor).padStart(2, "0");
  return `${texto(data.getDate())}/${texto(data.getMonth() + 1)} às ${texto(data.getHours())}:${texto(data.getMinutes())}`;
}

function tom(status: StatusExtrato) {
  if (status === "importado") return "ok" as const;
  if (status === "processando") return "default" as const;
  return "neg" as const;
}

export default function Extratos() {
  const [dados, setDados] = useState<ExtratosResposta | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const [conta, setConta] = useState("");
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [sobre, setSobre] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [contaId, setContaId] = useState("");
  const [nomeConta, setNomeConta] = useState("");
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoExtrato>({ date: 0, description: 1, amount: 2 });
  const [previa, setPrevia] = useState<LinhaExtrato[]>([]);
  const [formato, setFormato] = useState<"ofx" | "csv" | null>(null);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState<Extrato | null>(null);
  const [soErros, setSoErros] = useState(false);
  const [linhas, setLinhas] = useState<LinhasExtrato | null>(null);
  const [erroLinhas, setErroLinhas] = useState("");
  const [excluir, setExcluir] = useState<Extrato | null>(null);
  const [ocupado, setOcupado] = useState("");
  const importacao = useRef<HTMLDialogElement>(null);
  const linhasDialog = useRef<HTMLDialogElement>(null);
  const exclusao = useRef<HTMLDialogElement>(null);
  const arquivoInput = useRef<HTMLInputElement>(null);
  const pedidoPrevia = useRef(0);
  const pedidoLinhas = useRef(0);

  function carregar() {
    return api<ExtratosResposta>("/api/extratos")
      .then((resposta) => {
        setDados(resposta);
        setErroCarga("");
      })
      .catch((error: Error) => setErroCarga(error.message));
  }

  useEffect(() => {
    let ativo = true;
    api<ExtratosResposta>("/api/extratos")
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((error: Error) => {
        if (ativo) setErroCarga(error.message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function abrir(file?: File) {
    setErroForm("");
    setArquivo(null);
    setPrevia([]);
    setColunas([]);
    setFormato(null);
    setContaId("");
    setNomeConta("");
    setMapeamento({ date: 0, description: 1, amount: 2 });
    if (arquivoInput.current) arquivoInput.current.value = "";
    importacao.current?.showModal();
    if (file) void aplicarArquivo(file);
  }

  async function aplicarArquivo(file: File) {
    setErroForm("");
    setPrevia([]);
    setColunas([]);
    setFormato(null);
    if (file.size > LIMITE_EXTRATO_BYTES) {
      setArquivo(null);
      setErroForm("O arquivo passa de 5 MB.");
      return;
    }
    const nome = file.name.toLowerCase();
    if (!nome.endsWith(".ofx") && !nome.endsWith(".csv")) {
      setArquivo(null);
      setErroForm("Envie um arquivo OFX ou CSV.");
      return;
    }
    setArquivo(file);
    if (arquivoInput.current) {
      const transferencia = new DataTransfer();
      transferencia.items.add(file);
      arquivoInput.current.files = transferencia.files;
    }
    await lerPrevia(file, null);
  }

  async function lerPrevia(file: File, mapping: MapeamentoExtrato | null) {
    const atual = ++pedidoPrevia.current;
    try {
      const resposta = await api<PreviaExtrato>("/api/extratos/previa", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, content: await base64(file), mapping }),
      });
      if (atual !== pedidoPrevia.current) return;
      setFormato(resposta.format);
      setColunas(resposta.columns);
      setPrevia(resposta.lines);
      if (!mapping && resposta.mapping) setMapeamento(resposta.mapping);
      setErroForm("");
    } catch (error) {
      if (atual !== pedidoPrevia.current) return;
      setErroForm(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    }
  }

  async function importar(event: React.FormEvent) {
    event.preventDefault();
    if (!arquivo || salvando) return;
    setSalvando(true);
    setErroForm("");
    try {
      await api("/api/extratos", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          filename: arquivo.name,
          content: await base64(arquivo),
          accountId: contaId === NOVA ? null : contaId,
          accountName: contaId === NOVA ? nomeConta.trim() : null,
          mapping: formato === "csv" ? mapeamento : null,
        }),
      });
      await carregar();
      importacao.current?.close();
    } catch (error) {
      setErroForm(error instanceof Error ? error.message : "Não foi possível importar o extrato.");
    } finally {
      setSalvando(false);
    }
  }

  async function verLinhas(extrato: Extrato, erros: boolean) {
    const atual = ++pedidoLinhas.current;
    setAberto(extrato);
    setSoErros(erros);
    setLinhas(null);
    setErroLinhas("");
    linhasDialog.current?.showModal();
    try {
      const resposta = await api<LinhasExtrato>(`/api/extratos/${extrato.id}/linhas${erros ? "?erros=1" : ""}`);
      if (atual !== pedidoLinhas.current) return;
      setLinhas(resposta);
    } catch (error) {
      if (atual !== pedidoLinhas.current) return;
      setErroLinhas(error instanceof Error ? error.message : "Não foi possível ler as linhas.");
    }
  }

  async function reprocessar(extrato: Extrato) {
    setOcupado(extrato.id);
    try {
      await api(`/api/extratos/${extrato.id}/reprocessar`, { method: "POST", body: "{}" });
      await carregar();
    } catch (error) {
      setErroCarga(error instanceof Error ? error.message : "Não foi possível reprocessar o extrato.");
    } finally {
      setOcupado("");
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setOcupado(excluir.id);
    try {
      await api(`/api/extratos/${excluir.id}`, { method: "DELETE" });
      exclusao.current?.close();
      setExcluir(null);
      await carregar();
    } catch (error) {
      setErroCarga(error instanceof Error ? error.message : "Não foi possível excluir o extrato.");
    } finally {
      setOcupado("");
    }
  }

  const extratos = dados?.statements ?? [];
  const contas = dados?.accounts ?? [];
  const filtrados = extratos.filter((item) => {
    const nome = item.filename.toLowerCase().includes(busca.trim().toLowerCase());
    return (!conta || item.accountId === conta) && (!status || item.status === status) && nome;
  });
  const lidas = extratos.reduce((total, item) => total + item.lineCount, 0);
  const erros = extratos.reduce((total, item) => total + item.errorCount, 0);
  const ultima = extratos.reduce((maior, item) => (item.importedAt > maior ? item.importedAt : maior), "");

  return (
    <>
      <PageHeader
        title="Importações"
        subtitle="Importe extratos bancários e acompanhe o que já foi enviado."
        actions={
          <Button variant="primary" onClick={() => abrir()}>
            Importar extrato
          </Button>
        }
      />

      <button
        type="button"
        className={cn(
          "mb-6 grid w-full justify-items-center gap-1 rounded-lg border-2 border-dashed border-line bg-surface px-4 py-8 text-center hover:border-brand hover:bg-brand-soft",
          focusRing,
          sobre && "border-brand bg-brand-soft",
        )}
        onClick={() => abrir()}
        onDragOver={(event) => {
          event.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(event) => {
          event.preventDefault();
          setSobre(false);
          const file = event.dataTransfer.files[0];
          abrir(file);
        }}
      >
        <span className="font-bold">Arraste o extrato aqui</span>
        <span className="text-sm text-ink-2">ou clique para escolher · OFX ou CSV, até 5 MB</span>
      </button>

      {erroCarga ? <p className="mb-4 text-sm text-neg">{erroCarga}</p> : null}
      {!dados && !erroCarga ? <p className="text-sm text-ink-2">Carregando extratos.</p> : null}

      {dados ? (
        <>
          <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4" aria-label="Resumo das importações">
            <Stat label="Extratos">{extratos.length}</Stat>
            <Stat label="Linhas lidas">{lidas}</Stat>
            <Stat label="Linhas com erro">
              <span className={erros ? "text-neg" : undefined}>{erros}</span>
            </Stat>
            <Stat label="Última importação">{ultima ? quando(ultima) : "—"}</Stat>
          </dl>

          <div className="mb-4 flex flex-wrap gap-2">
            <select className={cn(field, "w-auto")} aria-label="Conta" value={conta} onChange={(event) => setConta(event.target.value)}>
              <option value="">Todas as contas</option>
              {contas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select className={cn(field, "w-auto")} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos os status</option>
              {STATUS_EXTRATO.map((item) => (
                <option key={item} value={item}>
                  {ROTULO[item]}
                </option>
              ))}
            </select>
            <input
              className={cn(field, "min-w-56 flex-1")}
              type="search"
              placeholder="Buscar pelo nome do arquivo"
              aria-label="Buscar"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>

          <ul className="overflow-hidden rounded-lg border border-line bg-surface" aria-live="polite">
            {filtrados.length ? (
              filtrados.map((item) => (
                <li key={item.id} className="grid gap-3 border-b border-line p-4 last:border-b-0 tab:grid-cols-[minmax(0,1fr)_auto] tab:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium break-all">
                      {item.filename} <Chip>{item.format.toUpperCase()}</Chip>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-2">
                      <span>{item.accountName}</span>
                      <span>{periodo(item)}</span>
                      <span>{item.status === "processando" ? "— linhas" : `${item.lineCount} linhas`}</span>
                      <span>Importado em {quando(item.importedAt)}</span>
                    </div>
                    {item.errorCount ? (
                      <div className="mt-2">
                        <Chip tone="neg">{item.errorCount} linhas com erro</Chip>
                      </div>
                    ) : null}
                    {item.status === "falhou" && item.message ? <p className="mt-2 text-sm text-neg">{item.message}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 tab:flex-nowrap tab:justify-end">
                    <Chip tone={tom(item.status)}>{ROTULO[item.status]}</Chip>
                    <Button variant="quiet" disabled={item.status === "processando" || ocupado === item.id} onClick={() => void verLinhas(item, false)}>
                      Ver linhas
                    </Button>
                    {item.errorCount || item.status === "falhou" ? (
                      <Button variant="quiet" disabled={ocupado === item.id} onClick={() => void reprocessar(item)}>
                        Reprocessar
                      </Button>
                    ) : null}
                    <Button
                      variant="quiet"
                      disabled={ocupado === item.id}
                      onClick={() => {
                        setExcluir(item);
                        exclusao.current?.showModal();
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-6 py-6 text-center text-ink-2">
                {extratos.length ? "Nenhum extrato com esses filtros." : "Nenhum extrato ainda. Importe o primeiro arquivo OFX ou CSV."}
              </li>
            )}
          </ul>
        </>
      ) : null}

      <dialog ref={importacao} className={dialogClass} aria-labelledby="titulo-importar" onClose={() => setSalvando(false)}>
        <h2 id="titulo-importar" className="mb-4 font-display text-lg">
          Importar extrato
        </h2>
        <form className="grid gap-4" onSubmit={(event) => void importar(event)}>
          <div className="grid gap-1">
            <label htmlFor="extrato-arquivo" className="text-sm font-medium">
              Arquivo
            </label>
            <input
              ref={arquivoInput}
              id="extrato-arquivo"
              className={`${field} h-auto py-2`}
              type="file"
              accept=".ofx,.csv"
              required
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void aplicarArquivo(file);
              }}
            />
            <span className="text-xs text-ink-2">OFX ou CSV, até 5 MB.</span>
          </div>
          <div className="grid gap-1">
            <label htmlFor="extrato-conta" className="text-sm font-medium">
              Conta
            </label>
            <select id="extrato-conta" className={field} required value={contaId} onChange={(event) => setContaId(event.target.value)}>
              <option value="">Escolha a conta</option>
              {contas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              <option value={NOVA}>Nova conta</option>
            </select>
          </div>
          {contaId === NOVA ? (
            <div className="grid gap-1">
              <label htmlFor="extrato-nova-conta" className="text-sm font-medium">
                Nome da conta
              </label>
              <input
                id="extrato-nova-conta"
                className={field}
                required
                maxLength={80}
                value={nomeConta}
                onChange={(event) => setNomeConta(event.target.value)}
              />
            </div>
          ) : null}
          {formato === "csv" && colunas.length ? (
            <div className="grid gap-2">
              <p className="text-xs text-ink-2">Este CSV precisa de mapeamento: indique qual coluna é cada campo.</p>
              <div className="grid gap-3 tab:grid-cols-3">
                {(
                  [
                    ["date", "Data", "extrato-data"],
                    ["description", "Descrição", "extrato-descricao"],
                    ["amount", "Valor", "extrato-valor"],
                  ] as const
                ).map(([chave, rotulo, id]) => (
                  <div key={chave} className="grid gap-1">
                    <label htmlFor={id} className="text-sm font-medium">
                      {rotulo}
                    </label>
                    <select
                      id={id}
                      className={field}
                      value={mapeamento[chave]}
                      onChange={(event) => {
                        const proximo = { ...mapeamento, [chave]: Number(event.target.value) };
                        setMapeamento(proximo);
                        if (arquivo) void lerPrevia(arquivo, proximo);
                      }}
                    >
                      {colunas.map((coluna, index) => (
                        <option key={`${coluna}-${index}`} value={index}>
                          {coluna}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {previa.length ? (
            <div>
              <p className="mb-2 text-sm text-ink-2">Prévia das primeiras linhas</p>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-line px-3 py-2 text-left font-semibold text-ink-2">Data</th>
                      <th className="border-b border-line px-3 py-2 text-left font-semibold text-ink-2">Descrição</th>
                      <th className="border-b border-line px-3 py-2 text-right font-semibold text-ink-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map((linha) => (
                      <tr key={linha.line} className="last:[&>td]:border-b-0">
                        <td className="border-b border-line px-3 py-2">{linha.date ? dia(linha.date) : "—"}</td>
                        <td className="border-b border-line px-3 py-2">{linha.description || "—"}</td>
                        <td className="border-b border-line px-3 py-2 text-right">
                          {linha.cents === null ? <span className="font-semibold text-neg">—</span> : <Money cents={linha.cents} strong />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {erroForm ? (
            <p role="alert" className="text-sm text-neg">
              {erroForm}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="quiet" onClick={() => importacao.current?.close()}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={salvando || !arquivo || !formato}>
              Importar
            </Button>
          </div>
        </form>
      </dialog>

      <dialog ref={linhasDialog} className={dialogLinhas} aria-labelledby="titulo-linhas">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="titulo-linhas" className="font-display text-lg break-all">
              {aberto?.filename}
            </h2>
            {aberto ? (
              <p className="text-sm text-ink-2">
                {aberto.accountName} · {periodo(aberto)}
              </p>
            ) : null}
          </div>
          <Button variant="quiet" onClick={() => linhasDialog.current?.close()}>
            Fechar
          </Button>
        </div>
        <label className="mb-3 flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-[18px] accent-brand"
            checked={soErros}
            onChange={(event) => {
              if (aberto) void verLinhas(aberto, event.target.checked);
            }}
          />
          Mostrar só linhas com erro
        </label>
        <div className="max-h-[55dvh] overflow-auto">
          {erroLinhas ? <p className="text-sm text-neg">{erroLinhas}</p> : null}
          {aberto?.status === "processando" ? <p className="py-6 text-center text-ink-2">Aguardando o processamento do arquivo.</p> : null}
          {aberto?.status === "falhou" ? <p className="py-6 text-center text-neg">{aberto.message}</p> : null}
          {aberto && aberto.status !== "processando" && aberto.status !== "falhou" ? (
            linhas ? (
              linhas.lines.length ? (
                <>
                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr>
                          {["Linha", "Data", "Descrição no extrato", "Valor", "Situação"].map((titulo) => (
                            <th
                              key={titulo}
                              className={cn(
                                "border-b border-line bg-surface px-3 py-2 text-left font-semibold text-ink-2",
                                titulo === "Valor" && "text-right",
                              )}
                            >
                              {titulo}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.lines.map((linha) => (
                          <tr key={linha.line} className="last:[&>td]:border-b-0">
                            <td className="border-b border-line px-3 py-2 align-top">{linha.line}</td>
                            <td className="border-b border-line px-3 py-2 align-top">{linha.date ? dia(linha.date) : "—"}</td>
                            <td className="border-b border-line px-3 py-2 align-top">{linha.description || "—"}</td>
                            <td className="border-b border-line px-3 py-2 text-right align-top whitespace-nowrap">
                              {linha.cents === null ? <span className="font-semibold text-neg">—</span> : <Money cents={linha.cents} strong />}
                            </td>
                            <td className="border-b border-line px-3 py-2 align-top">
                              {linha.error ? <Chip tone="neg">{linha.error}</Chip> : <Chip tone="ok">Lida</Chip>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-sm text-ink-2">
                    {linhas.lines.length < linhas.matched
                      ? `Mostrando ${linhas.lines.length} das primeiras ${linhas.lines.length} (total de ${linhas.total} linhas).`
                      : `Mostrando ${linhas.lines.length} linhas.`}
                  </p>
                </>
              ) : (
                <p className="py-6 text-center text-ink-2">
                  {soErros && linhas.total ? "Nenhuma linha com erro." : "Nenhuma linha disponível."}
                </p>
              )
            ) : erroLinhas ? null : (
              <p className="py-6 text-center text-ink-2">Carregando linhas.</p>
            )
          ) : null}
        </div>
      </dialog>

      <dialog ref={exclusao} className={dialogClass} aria-labelledby="titulo-excluir">
        <h2 id="titulo-excluir" className="mb-4 font-display text-lg">
          Excluir extrato?
        </h2>
        <p>
          O arquivo &quot;{excluir?.filename}&quot; e as linhas importadas dele serão removidos. Essa ação não pode ser desfeita.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => exclusao.current?.close()}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={ocupado === excluir?.id} onClick={() => void confirmarExclusao()}>
            Excluir extrato
          </Button>
        </div>
      </dialog>
    </>
  );
}
