-- O saldo inicial da conta e da caixinha ganha a data: só o que acontece a partir dela conta no saldo.
ALTER TABLE "accounts" ADD COLUMN "opening_on" DATE;
ALTER TABLE "account_boxes" ADD COLUMN "opening_on" DATE;
