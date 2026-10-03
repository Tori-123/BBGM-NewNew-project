import { CJBoard } from "../cj-board";

function mondayIso() {
  const result = new Date();
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const params = await searchParams;
  const initialWeekStart = /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") ? params.start! : mondayIso();
  return <CJBoard initialWeekStart={initialWeekStart} />;
}
