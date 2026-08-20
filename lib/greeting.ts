/** Saudação conforme o horário (padrão Brasil). */
export function getTimeGreeting(
  date = new Date(),
  timeZone = "America/Sao_Paulo"
): "Bom dia" | "Boa tarde" | "Boa noite" {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(date)
  );

  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}
