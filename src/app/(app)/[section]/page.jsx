import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
const sections = [
  'overview',
  'income',
  'expenses',
  'cards',
  'accounts',
  'planning',
  'calendar',
  'budgets',
  'goals',
  'debts',
  'investments',
  'reports',
  'settings',
];
export default async function Page({ params }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <Workspace section={section} />;
}
