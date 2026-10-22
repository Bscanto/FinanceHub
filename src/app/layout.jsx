import './globals.css';
export const metadata = {
  title: 'FinanceHub · Sua vida financeira, em equilíbrio',
  description:
    'Controle suas finanças pessoais com clareza: contas, cartões, metas e planejamento.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
