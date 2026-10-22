import { test, expect } from '@playwright/test';
test('conta → receita → recebimento parcial → persistência → cartão → projeção', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/overview');
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('E-mail', { exact: true }).fill('teste@financehub.local');
  await page.getByLabel('Senha', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill('Conta de teste');
  await dialog.getByLabel('Saldo inicial (R$)').fill('1.000,00');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Nova movimentação', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('income');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Salário E2E');
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('5.000,00');
  await dialog
    .getByRole('combobox', { name: 'Categoria', exact: true })
    .selectOption({ label: 'Salário principal' });
  await dialog.getByRole('combobox', { name: 'Conta', exact: true }).selectOption({ label: 'Conta de teste' });
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('link', { name: 'Receitas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Suas receitas' })).toBeVisible();
  await page.getByRole('button', { name: 'Receber', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('2.000,00');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Parcial', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Parcial', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Contas e carteiras', exact: true }).click();
  await expect(page.getByText('R$ 3.000,00', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Cartões', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar cartão', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill('Cartão E2E');
  await dialog.getByLabel('Limite (R$)').fill('10.000,00');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Registrar compra' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Compra em seis parcelas');
  await dialog.getByRole('combobox', { name: 'Cartão', exact: true }).selectOption({ label: 'Cartão E2E' });
  await dialog.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption({ label: 'Compras' });
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('1.200,00');
  await dialog.getByLabel('Número de parcelas').fill('6');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel('Todas as competências').check();
  await expect(page.getByText('R$ 200,00', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Simulador financeiro' })).toBeVisible();
  for (const name of [
    'Calendário',
    'Orçamentos',
    'Metas',
    'Dívidas',
    'Investimentos',
    'Relatórios',
    'Configurações',
    'Despesas',
  ]) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.locator('.error-panel')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('link', { name: 'Planejamento', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
