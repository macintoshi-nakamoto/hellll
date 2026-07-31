import { TronWeb } from 'tronweb';

const mnemonic = "maximum width shallow planet mouse keen metal aware quick exile spot suit";

const account = TronWeb.fromMnemonic(mnemonic);

console.log("Адрес:", account.address);
console.log("Приватный ключ (полный):", account.privateKey);
console.log("Длина ключа с 0x:", account.privateKey.length);
console.log("Ключ без 0x:", account.privateKey.replace(/^0x/, ""));
console.log("Длина без 0x:", account.privateKey.replace(/^0x/, "").length);
