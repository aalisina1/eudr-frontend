export function AdministrationHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-display text-4xl leading-[1.04]">{title}</h1>
      <p className="mt-2.5 max-w-2xl text-base text-muted-foreground">{description}</p>
    </div>
  );
}
