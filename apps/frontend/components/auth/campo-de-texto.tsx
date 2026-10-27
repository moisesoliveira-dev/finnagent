import { campo, cn } from "../ui/cn";

/** Rótulo e campo de texto de login e cadastro. A senha tem o próprio componente. */
export function CampoDeTexto({
  id,
  rotulo,
  invalido,
  inputRef,
  ...props
}: Omit<React.ComponentProps<"input">, "id" | "className" | "ref"> & {
  id: string;
  rotulo: string;
  invalido: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input id={id} ref={inputRef} aria-invalid={invalido} className={cn(campo, "w-full")} {...props} />
    </div>
  );
}
