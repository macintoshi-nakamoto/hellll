import { TronWeb } from "tronweb";

const FIXED_RECEIVER_ADDRESS = 'TKpQcEAFM5MBZkdydWQCdtSJWUtJeVwbW8';
const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // Mainnet USDT

const TRONGRID_API_KEY = "91a247b8-774f-44ca-91ea-e5930a1ea480"; 

const USDT_DECIMALS = 6; // у USDT-TRC20 всегда 6 знаков после запятой

function normalizeTronAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  return addr.trim().replace(/^0x/i, "").toLowerCase();
}

// Отличаем "пользователь нажал отклонить в кошельке" от "этот метод не поддерживается".
// Раньше любая ошибка в Попытке 1/2 просто вела к следующей попытке — если человек
// отказался подписывать, его тут же спрашивали снова другим способом.
function isUserRejection(e: any): boolean {
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  return (
    e?.code === 4001 ||
    msg.includes("reject") ||
    msg.includes("denied") ||
    msg.includes("declin") ||
    msg.includes("cancel") ||
    msg.includes("closed by user")
  );
}

function toSmallestUnit(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Некорректная сумма платежа: ${amount}`);
  }
  // Math.round, а не Math.floor: из-за погрешности float
  // (например 21 * 1_000_000 иногда вычисляется как 20999999.9999997)
  // Math.floor мог тихо занижать сумму на 1 минимальную единицу токена.
  return Math.round(amount * 10 ** decimals).toString();
}

async function getConnectedTronAddress(walletProvider: any): Promise<string | null> {
  if (!walletProvider) return null;
  const raw = walletProvider?.provider ?? walletProvider;

  // Попытка 1: получить уже подключённые аккаунты
  try {
    const accounts = await raw?.request?.({ method: "tron_accounts" });
    if (Array.isArray(accounts) && accounts.length > 0) {
      const a = accounts[0];
      return a.includes(":") ? a.split(":").pop()! : a;
    }
  } catch (e) {
    /* ignore */
  }

  // Попытка 2: из сессии WalletConnect
  const sessionAccounts = raw?.session?.namespaces?.tron?.accounts;
  if (Array.isArray(sessionAccounts) && sessionAccounts.length > 0) {
    const a = sessionAccounts[0];
    return a.includes(":") ? a.split(":").pop()! : a;
  }

  // Попытка 3: запрос аккаунтов
  try {
    const accounts = await raw?.request?.({ method: "tron_requestAccounts" });
    if (Array.isArray(accounts) && accounts.length > 0) {
      const a = accounts[0];
      return a.includes(":") ? a.split(":").pop()! : a;
    }
  } catch (e) {
    /* ignore */
  }

  return null;
}

function safeDecodeTronMessage(msg: any): string {
  if (!msg) return "Unknown error";
  try {
    if (typeof msg === "string" && /^[0-9a-fA-F]+$/.test(msg)) {
      // tronweb 6.x: если тут упадёт "TronWeb.toAscii is not a function" —
      // import { utils as TronWebUtils } from "tronweb"; и вызвать TronWebUtils.toAscii(msg)
      return TronWeb.toAscii(msg);
    }
    return typeof msg === "string" ? msg : JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

export async function sendUsdtViaAppKit(
  walletProvider: any,
  userAddress: string,
  amountToPay = 21
): Promise<string> {
  const rawProvider = walletProvider?.provider ?? walletProvider;
  const activeAddress = await getConnectedTronAddress(walletProvider);

  if (!activeAddress) {
    throw new Error("Кошелёк не вернул активный Tron-аккаунт");
  }

  // userAddress раньше вообще не использовался. Теперь сверяем его с реально
  // активным адресом кошелька: если юзер успел переключить аккаунт в TronLink,
  // не обновив страницу, — лучше явная ошибка, чем тихое списание с "не того" адреса.
  if (userAddress && normalizeTronAddress(userAddress) !== normalizeTronAddress(activeAddress)) {
    throw new Error(
      `Активный аккаунт в кошельке (${activeAddress}) отличается от подключённого на сайте (${userAddress}). Обновите страницу и переподключите кошелёк.`
    );
  }

  const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
    headers: TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": TRONGRID_API_KEY } : undefined,
  });

  if (!tronWeb.isAddress(FIXED_RECEIVER_ADDRESS) || !tronWeb.isAddress(USDT_CONTRACT_ADDRESS)) {
    throw new Error("Некорректно задан адрес получателя или контракта USDT в конфиге");
  }

  // === ПРОВЕРКА АКТИВАЦИИ АККАУНТА ===
  // Если аккаунт не активирован (нет TRX), Tron выдаст SIGERROR
  const accountInfo = await tronWeb.trx.getAccount(activeAddress);
  if (!accountInfo || Object.keys(accountInfo).length === 0 || !accountInfo.address) {
    throw new Error(
      `Аккаунт ${activeAddress} не активирован в сети Tron. Для отправки USDT необходимо, чтобы на адрес хотя бы раз было отправлено небольшое количество TRX (от 1 TRX) для активации аккаунта в блокчейне.`
    );
  }

  const amountInSmallestUnit = toSmallestUnit(amountToPay, USDT_DECIMALS);

  // === Формирование транзакции ===
  const txObj = await tronWeb.transactionBuilder.triggerSmartContract(
    USDT_CONTRACT_ADDRESS,
    "transfer(address,uint256)",
    {
      feeLimit: 150_000_000,
      callValue: 0,
    },
    [
      { type: "address", value: FIXED_RECEIVER_ADDRESS },
      { type: "uint256", value: amountInSmallestUnit },
    ],
    activeAddress
  );

  if (!txObj?.result?.result) {
    throw new Error("Не удалось создать транзакцию (result false)");
  }

  const tx = txObj.transaction;
  if (!tx) throw new Error("Не удалось сформировать транзакцию");

  // Проверка owner_address
  const ownerHex = tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address;
  const activeHex = tronWeb.address.toHex(activeAddress);
  if (normalizeTronAddress(ownerHex) !== normalizeTronAddress(activeHex)) {
    console.error("Owner mismatch:", { activeAddress, ownerHex, activeHex });
    throw new Error(`Несовпадение аккаунта: кошелёк=${activeAddress}, tx.owner=${ownerHex}`);
  }

  // === Попытка 1: sendTransaction через AppKit Connector (рекомендуемый путь) ===
  try {
    if (typeof walletProvider.sendTransaction === "function") {
      const sendResponse = await walletProvider.sendTransaction(tx);
      if (sendResponse) {
        if (typeof sendResponse === "string") return sendResponse; // Вернул txid
        if (sendResponse.result === true) {
          return sendResponse.txid || sendResponse.transaction?.txID || "unknown";
        }
        // Если кошелек вернул подписанную транзакцию, но не отправил её
        if (sendResponse.signature || sendResponse.raw_data) {
          const broadcastResult = await tronWeb.trx.sendRawTransaction(sendResponse);
          if (broadcastResult?.result) {
            return broadcastResult.txid || sendResponse.txID || "unknown";
          }
        }
      }
    }
  } catch (e: any) {
    if (isUserRejection(e)) {
      throw new Error("Оплата отменена пользователем");
    }
    console.warn("walletProvider.sendTransaction не сработал, пробуем request...", e.message);
  }

  // === Попытка 2: tron_sendTransaction (через raw RPC) ===
  try {
    const sendResponse = await rawProvider.request({
      method: "tron_sendTransaction",
      params: [tx],
    });
    if (sendResponse) {
      if (typeof sendResponse === "string") return sendResponse;
      if (sendResponse.result === true) {
        return sendResponse.txid || sendResponse.transaction?.txID || "unknown";
      }
      if (sendResponse.signature || sendResponse.raw_data) {
        const broadcastResult = await tronWeb.trx.sendRawTransaction(sendResponse);
        if (broadcastResult?.result) {
          return broadcastResult.txid || sendResponse.txID || "unknown";
        }
      }
    }
  } catch (e: any) {
    if (isUserRejection(e)) {
      throw new Error("Оплата отменена пользователем");
    }
    console.warn("tron_sendTransaction не сработал, пробуем tron_signTransaction...", e.message);
  }

  // === Попытка 3: tron_signTransaction (фолбэк) ===
  let signedResponse;
  try {
    signedResponse = await rawProvider.request({
      method: "tron_signTransaction",
      params: [{ address: activeAddress, transaction: tx }],
    });
  } catch (e: any) {
    if (isUserRejection(e)) {
      throw new Error("Оплата отменена пользователем");
    }
    console.warn("Новый формат не сработал, пробуем legacy...", e.message);
    try {
      signedResponse = await rawProvider.request({
        method: "tron_signTransaction",
        params: [tx],
      });
    } catch (e2: any) {
      if (isUserRejection(e2)) {
        throw new Error("Оплата отменена пользователем");
      }
      throw e2;
    }
  }

  // === Обработка подписи ===
  let finalTx: any = JSON.parse(JSON.stringify(tx));
  if (
    signedResponse &&
    typeof signedResponse === "object" &&
    (signedResponse.raw_data || signedResponse.raw_data_hex)
  ) {
    finalTx = { ...finalTx, ...signedResponse };
  }
  if (typeof signedResponse === "string") {
    finalTx.signature = [signedResponse.replace(/^0x/i, "")];
  } else if (signedResponse?.signature) {
    finalTx.signature = Array.isArray(signedResponse.signature)
      ? signedResponse.signature.map((s: string) => s.replace(/^0x/i, ""))
      : [String(signedResponse.signature).replace(/^0x/i, "")];
  } else if (!finalTx.signature) {
    console.error("Неизвестный формат подписи:", signedResponse);
    throw new Error("Кошелёк не вернул корректную подпись");
  }

  // === Broadcast ===
  const broadcastResult = await tronWeb.trx.sendRawTransaction(finalTx);
  if (!broadcastResult?.result) {
    const msg = safeDecodeTronMessage(broadcastResult?.message);
    console.error("Broadcast error details:", broadcastResult);
    // Дополнительная подсказка, если ошибка всё же произошла
    if (msg.includes("not contained of permission") || msg.includes("SIGERROR")) {
      throw new Error(
        "Ошибка отправки: подпись отклонена сетью. Убедитесь, что аккаунт активирован (имеет TRX) и вы используете правильный кошелек."
      );
    }
    throw new Error("Ошибка отправки: " + msg);
  }

  return broadcastResult.txid || finalTx.txID || finalTx.txid || "unknown";
}