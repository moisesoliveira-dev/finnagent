"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  LIMITE_EXTRATO_BYTES,
  STATUS_EXTRATO,
  type FormatoExtrato,
  type Extrato,
  type ExtratosResposta,
  type LinhaExtrato,
  type LinhasExtrato,
  type MapeamentoExtrato,
  type PreviaExtrato,
  type StatusExtrato,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
import { Dialogo } from "../../components/ui/dialogo";
import { ItemAnimado, ListaAnimada, useCurva } from "../../components/ui/movimento";
import { Icone } from "../../components/ui/icone";
import { Vazio } from "../../components/ui/vazio";
import { Abas } from "../eventos/ferramentas";
import { Dica, Rotulo } from "../../components/ui/rotulo";
import { Chip } from "../../components/ui/chip";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Money } from "../../components/ui/money";
import { PageHeader } from "../../components/ui/page-header";
import { Stat } from "../../components/ui/stat";
import { useToast } from "../../components/ui/toast";

const NOVA = "nova";
const field = cn(campo, "w-full");

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

// Barra de saúde da leitura: o que entrou limpo em azul e o que deu erro em vermelho, crescendo da esquerda.
function Saude({ lidas, erros }: { lidas: number; erros: number }) {
  const curva = useCurva();
  const total = Math.max(lidas, 1);
  const limpas = Math.max(lidas - erros, 0);
  return (
    <div
      role="img"
      aria-label={`${limpas} linhas lidas sem erro e ${erros} com erro`}
      className="flex h-2 w-full gap-1 bg-surface-2"
    >
      <motion.span
        className="origin-left bg-brand"
        style={{ width: `${(limpas / total) * 100}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={curva}
      />
      <motion.span
        className="origin-left bg-neg"
        style={{ width: `${(erros / total) * 100}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={curva}
      />
    </div>
  );
}

export default function Extratos() {
  const toast = useToast();
  const curva = useCurva();
  const [dados, setDados] = useState<ExtratosResposta | null>(null);
  const [falhou, setFalhou] = useState(false);
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
  const [formato, setFormato] = useState<FormatoExtrato | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState<Extrato | null>(null);
  const [soErros, setSoErros] = useState(false);
  const [linhas, setLinhas] = useState<LinhasExtrato | null>(null);
  const [linhasFalhou, setLinhasFalhou] = useState(false);
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
        setFalhou(false);
      })
      .catch((error: Error) => {
        setFalhou(true);
        toast.erro(error.message);
      });
  }

  useEffect(() => {
    let ativo = true;
    api<ExtratosResposta>("/api/extratos")
      .then((resposta) => {
        if (ativo) setDados(resposta);
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalhou(true);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!dados?.statements.some((item) => item.status === "processando")) return;
    const timer = setInterval(() => {
      void api<ExtratosResposta>("/api/extratos")
        .then((resposta) => {
          setDados(resposta);
          setFalhou(false);
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [dados]);

  function abrir(file?: File) {
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
    setPrevia([]);
    setColunas([]);
    setFormato(null);
    if (file.size > LIMITE_EXTRATO_BYTES) {
      setArquivo(null);
      toast.erro("O arquivo passa de 5 MB.");
      return;
    }
    const nome = file.name.toLowerCase();
    const ocr = [".png", ".jpg", ".jpeg", ".webp", ".pdf"].some((extensao) => nome.endsWith(extensao));
    if (!nome.endsWith(".ofx") && !nome.endsWith(".csv") && !ocr) {
      setArquivo(null);
      toast.erro("Envie um OFX, um CSV ou uma imagem do extrato.");
      return;
    }
    setArquivo(file);
    if (arquivoInput.current) {
      const transferencia = new DataTransfer();
      transferencia.items.add(file);
      arquivoInput.current.files = transferencia.files;
    }
    if (ocr) {
      setFormato("ocr");
      return;
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
    } catch (error) {
      if (atual !== pedidoPrevia.current) return;
      toast.erro(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    }
  }

  async function importar(event: React.FormEvent) {
    event.preventDefault();
    if (!arquivo || salvando) return;
    setSalvando(true);
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
      toast.sucesso(formato === "ocr" ? "Extrato recebido. A leitura segue na lista." : "Extrato importado.");
      await carregar();
      importacao.current?.close();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível importar o extrato.");
    } finally {
      setSalvando(false);
    }
  }

  async function verLinhas(extrato: Extrato, erros: boolean) {
    const atual = ++pedidoLinhas.current;
    setAberto(extrato);
    setSoErros(erros);
    setLinhas(null);
    setLinhasFalhou(false);
    linhasDialog.current?.showModal();
    try {
      const resposta = await api<LinhasExtrato>(`/api/extratos/${extrato.id}/linhas${erros ? "?erros=1" : ""}`);
      if (atual !== pedidoLinhas.current) return;
      setLinhas(resposta);
    } catch (error) {
      if (atual !== pedidoLinhas.current) return;
      setLinhasFalhou(true);
      toast.erro(error instanceof Error ? error.message : "Não foi possível ler as linhas.");
    }
  }

  async function reprocessar(extrato: Extrato) {
    setOcupado(extrato.id);
    try {
      await api(`/api/extratos/${extrato.id}/reprocessar`, { method: "POST", body: "{}" });
      toast.sucesso("Extrato reprocessado.");
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível reprocessar o extrato.");
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
      toast.sucesso("Extrato excluído.");
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível excluir o extrato.");
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

      <motion.button
        type="button"
        className={cn(
          "group mb-6 flex w-full min-w-0 items-center gap-4 border border-dashed border-line bg-surface p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft tab:p-6",
          focusRing,
          sobre && "border-brand bg-brand-soft",
        )}
        animate={{ scale: sobre ? 1.01 : 1 }}
        transition={curva}
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
        <motion.span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center border border-line bg-surface-2 text-brand group-hover:border-brand"
          animate={{ y: sobre ? -4 : 0 }}
          transition={curva}
        >
          <Icone name="upload" />
        </motion.span>
        <span className="grid min-w-0 flex-1 gap-2">
          <span className="font-display text-lg">{sobre ? "Solte para importar" : "Arraste o extrato aqui"}</span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span>ou clique para escolher</span>
            {["OFX", "CSV", "Foto", "PDF"].map((formato) => (
              <Chip key={formato}>{formato}</Chip>
            ))}
            <span>até 5 MB</span>
          </span>
        </span>
      </motion.button>

      {!dados && !falhou ? <Carregando texto="Carregando extratos." linhas={3} /> : null}

      {dados ? (
        <>
          <section aria-label="Resumo das importações" className="mb-6 grid min-w-0 gap-4 border border-line bg-surface p-4">
            <dl className="flex flex-wrap gap-x-8 gap-y-4">
              <Stat label="Extratos">{extratos.length}</Stat>
              <Stat label="Linhas lidas">{lidas}</Stat>
              <Stat label="Linhas com erro">
                <span className={erros ? "text-neg" : undefined}>{erros}</span>
              </Stat>
              <Stat label="Última importação">{ultima ? quando(ultima) : "—"}</Stat>
            </dl>
            <Saude lidas={lidas} erros={erros} />
          </section>

          <div className="mb-4 grid min-w-0 gap-3">
            <Abas
              rotulo="Conta"
              valor={conta || null}
              onEscolher={(id) => setConta(id ?? "")}
              opcoes={[
                { id: null, nome: "Todas", total: extratos.length },
                ...contas.map((item) => ({
                  id: item.id,
                  nome: item.name,
                  total: extratos.filter((extrato) => extrato.accountId === item.id).length,
                })),
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <select className={cn(field, "w-auto")} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos os status</option>
                {STATUS_EXTRATO.map((item) => (
                  <option key={item} value={item}>
                    {ROTULO[item]}
                  </option>
                ))}
              </select>
              <input
                className={cn(field, "min-w-0 flex-1")}
                type="search"
                placeholder="Buscar pelo nome do arquivo"
                aria-label="Buscar"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </div>
          </div>

          {filtrados.length ? (
            <ListaAnimada className="grid min-w-0 gap-4 tab:grid-cols-2 desk:grid-cols-3" aria-live="polite">
              {filtrados.map((item) => (
                <ItemAnimado
                  key={item.id}
                  whileHover={{ y: -2 }}
                  className="grid min-w-0 content-start gap-4 border border-line bg-surface p-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "etiqueta grid size-12 shrink-0 place-items-center border",
                        item.status === "importado" ? "border-transparent bg-brand-soft text-brand" : "border-line bg-surface-2 text-ink-2",
                        item.status === "falhou" && "border-neg bg-transparent text-neg",
                      )}
                    >
                      {item.format.toUpperCase()}
                    </span>
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="font-medium break-all">{item.filename}</div>
                      <div className="text-sm text-ink-2">{item.accountName}</div>
                    </div>
                    <Chip tone={tom(item.status)}>{ROTULO[item.status]}</Chip>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="tabular-nums">{periodo(item)}</span>
                      <span className="text-ink-2 tabular-nums">
                        {item.status === "processando" ? "— linhas" : `${item.lineCount} linhas`}
                      </span>
                    </div>
                    {item.status === "processando" ? (
                      <p className="text-sm text-ink-2">Lendo o arquivo.</p>
                    ) : (
                      <Saude lidas={item.lineCount} erros={item.errorCount} />
                    )}
                    {item.errorCount ? (
                      <Chip tone="neg" className="w-fit">
                        {item.errorCount} linhas com erro
                      </Chip>
                    ) : null}
                    {item.message && item.status !== "processando" ? <p className="text-sm text-neg">{item.message}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="etiqueta text-ink-2">{quando(item.importedAt)}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="quiet" disabled={item.status === "processando" || ocupado === item.id} onClick={() => void verLinhas(item, false)}>
                        Ver linhas
                      </Button>
                      {item.errorCount || item.status === "falhou" ? (
                        <Button
                          variant="quiet"
                          className="size-10 px-0"
                          aria-label="Reprocessar"
                          title="Reprocessar"
                          disabled={ocupado === item.id}
                          onClick={() => void reprocessar(item)}
                        >
                          <Icone name="refresh" />
                        </Button>
                      ) : null}
                      <Button
                        variant="quiet"
                        className="size-10 px-0"
                        aria-label="Excluir"
                        title="Excluir"
                        disabled={ocupado === item.id}
                        onClick={() => {
                          setExcluir(item);
                          exclusao.current?.showModal();
                        }}
                      >
                        <Icone name="remove" />
                      </Button>
                    </div>
                  </div>
                </ItemAnimado>
              ))}
            </ListaAnimada>
          ) : (
            <Vazio>
              {extratos.length ? "Nenhum extrato com esses filtros." : "Nenhum extrato ainda. Importe um OFX, um CSV ou uma foto do extrato."}
            </Vazio>
          )}
        </>
      ) : null}

      <Dialogo ref={importacao} aria-labelledby="titulo-importar" onClose={() => setSalvando(false)}>
        <h2 id="titulo-importar" className="mb-4 font-display text-lg">
          Importar extrato
        </h2>
        <form onSubmit={(event) => void importar(event)}>
          <div className="dialog-corpo grid gap-4">
          <div className="grid gap-1">
            <Rotulo htmlFor="extrato-arquivo" dica="OFX, CSV ou uma foto ou PDF do extrato, até 5 MB. A foto é lida e organizada para você conferir.">
              Arquivo
            </Rotulo>
            <input
              ref={arquivoInput}
              id="extrato-arquivo"
              className={`${field} h-auto py-2`}
              type="file"
              accept=".ofx,.csv,.png,.jpg,.jpeg,.webp,.pdf"
              required
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void aplicarArquivo(file);
              }}
            />
            <span className="text-xs text-ink-2">OFX, CSV, foto ou PDF, até 5 MB.</span>
            {formato === "ocr" ? (
              <p className="text-sm text-ink-2">
                A leitura acontece depois de importar. O status do extrato mostra o resultado ou o erro.
              </p>
            ) : null}
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="extrato-conta" dica="A conta deste extrato. Você pode criar uma nova.">
              Conta
            </Rotulo>
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
              <Rotulo htmlFor="extrato-nova-conta" dica="O nome da conta que vai receber este extrato.">
                Nome da conta
              </Rotulo>
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
                    ["date", "Data", "extrato-data", "Qual coluna do CSV traz a data."],
                    ["description", "Descrição", "extrato-descricao", "Qual coluna do CSV traz a descrição."],
                    ["amount", "Valor", "extrato-valor", "Qual coluna do CSV traz o valor."],
                  ] as const
                ).map(([chave, rotulo, id, dica]) => (
                  <div key={chave} className="grid gap-1">
                    <Rotulo htmlFor={id} dica={dica}>
                      {rotulo}
                    </Rotulo>
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
                      <th className="border-b border-line px-3 py-2 text-left etiqueta text-ink-2">Data</th>
                      <th className="border-b border-line px-3 py-2 text-left etiqueta text-ink-2">Descrição</th>
                      <th className="border-b border-line px-3 py-2 text-right etiqueta text-ink-2">Valor</th>
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
          </div>
          <div className="dialog-acoes">
            <Button variant="quiet" onClick={() => importacao.current?.close()}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={salvando || !arquivo || !formato}>
              Importar
            </Button>
          </div>
        </form>
      </Dialogo>

      <Dialogo ref={linhasDialog} largura="larga" aria-labelledby="titulo-linhas">
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
        <div className="dialog-corpo">
        <label className="mb-3 flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className={`size-4 accent-brand ${focusRing}`}
            checked={soErros}
            onChange={(event) => {
              if (aberto) void verLinhas(aberto, event.target.checked);
            }}
          />
          <span className="inline-flex items-center gap-1">
            Mostrar só linhas com erro
            <Dica texto="Esconde as linhas que foram lidas sem problema." />
          </span>
        </label>
        <div>
          {aberto?.status === "processando" ? <p className="py-6 text-center text-ink-2">Aguardando o processamento do arquivo.</p> : null}
          {aberto?.status === "falhou" ? <p className="py-6 text-center text-neg">{aberto.message}</p> : null}
          {aberto && aberto.status !== "processando" && aberto.status !== "falhou" ? (
            linhas ? (
              linhas.lines.length ? (
                <>
                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="w-full border-separate border-spacing-0 text-sm">
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
                      ? `Mostrando as primeiras ${linhas.lines.length} de ${linhas.matched} linhas.`
                      : `Mostrando ${linhas.lines.length} linhas.`}
                  </p>
                </>
              ) : (
                <p className="py-6 text-center text-ink-2">
                  {soErros && linhas.total ? "Nenhuma linha com erro." : "Nenhuma linha disponível."}
                </p>
              )
            ) : linhasFalhou ? null : (
              <Carregando texto="Carregando linhas." linhas={5} className="py-4" />
            )
          ) : null}
        </div>
        </div>
      </Dialogo>

      <Dialogo ref={exclusao} aria-labelledby="titulo-excluir" onClose={() => setExcluir(null)}>
        <div className="dialog-corpo">
        <h2 id="titulo-excluir" className="mb-4 font-display text-lg">
          Excluir extrato?
        </h2>
        <p>
          O arquivo &quot;{excluir?.filename}&quot; e as linhas importadas dele serão removidos. Essa ação não pode ser desfeita.
        </p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => exclusao.current?.close()}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={ocupado === excluir?.id} onClick={() => void confirmarExclusao()}>
            Excluir extrato
          </Button>
        </div>
      </Dialogo>
    </>
  );
}
