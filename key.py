from bip_utils import (
    Bip39SeedGenerator,
    Bip44,
    Bip44Coins,
    Bip44Changes,
)

mnemonic = "globe income random hollow giggle vendor sheriff aspect upon since truck cattle"

seed = Bip39SeedGenerator(mnemonic).Generate()

wallet = (
    Bip44.FromSeed(seed, Bip44Coins.TRON)
    .Purpose()
    .Coin()
    .Account(0)
    .Change(Bip44Changes.CHAIN_EXT)
    .AddressIndex(0)
)

print("Private key:", wallet.PrivateKey().Raw().ToHex())
print("Public key :", wallet.PublicKey().RawCompressed().ToHex())
print("Address    :", wallet.PublicKey().ToAddress())
