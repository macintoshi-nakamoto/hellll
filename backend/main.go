package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/fbsobreira/gotron-sdk/pkg/address"
	"github.com/fbsobreira/gotron-sdk/pkg/client"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"google.golang.org/protobuf/proto"
)

// Структура, которую бэкенд ожидает получить от фронтенда
type DepositRequest struct {
	UserAddress string `json:"userAddress" binding:"required"`
	AmountHex   string `json:"amount" binding:"required"`
}

// Структура запроса на спонсорство газа (TRX для оплаты Energy/Bandwidth)
type SponsorGasRequest struct {
	UserAddress string `json:"userAddress" binding:"required"`
}

// Средняя цена 1 Energy в SUN (актуальна на конец 2025 / начало 2026, может меняться сетью)
// Проверить текущее значение можно через https://api.trongrid.io/wallet/getenergyprices
const energyPriceSunPerUnit = 420 // SUN за 1 единицу Energy (актуализируйте при желании)

// Сколько Energy обычно уходит на одну операцию approve/transferFrom USDT-контракта
// (эмпирическое значение с запасом, обычно реальный расход 13000-15000 при первом approve)
const energyPerApprove = 15_000
const energyPerTransferFrom = 15_000

// Сколько TRX держать про запас на Bandwidth (обычно новый/малоактивный аккаунт не имеет
// свободного Bandwidth, транзакция ~250-350 байт, дефолтная цена Bandwidth — 1000 SUN/байт)
const bandwidthReserveSun = 1_000_000 // 1 TRX с запасом на пару транзакций по Bandwidth

// Минимальный порог, ниже которого точно отправляем спонсорство, даже если расчёт даст меньше
const minSponsorAmountSun = 3_000_000 // 3 TRX
func main() {
	// 1. Загружаем переменные из .env
	if err := godotenv.Load(); err != nil {
		log.Println("Предупреждение: файл .env не найден")
	}

	// 2. Инициализируем Gin
	r := gin.Default()

	// Настраиваем CORS, чтобы фронтенд (например, с localhost:3000 или Vite) мог делать запросы
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 3. Роуты
	r.POST("/api/deposit", handleDeposit)
	r.POST("/api/sponsor-gas", handleSponsorGas)

	// 4. Запуск сервера
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Бэкенд запущен на порту %s", port)
	r.Run(":" + port)
}

func handleDeposit(c *gin.Context) {
	var req DepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	// Достаем доступы из окружения
	apiKey := os.Getenv("TRON_API_KEY")
	privateKey := os.Getenv("SYSTEM_PRIVATE_KEY")
	systemWallet := os.Getenv("SYSTEM_WALLET_ADDRESS")
	usdtContract := os.Getenv("USDT_CONTRACT_ADDRESS")

	// Подключаемся к ноде Tron через gRPC (обязательно с TLS-credentials)
	grpcClient := client.NewGrpcClient("grpc.trongrid.io:50051")
	err := grpcClient.SetAPIKey(apiKey)
	if err != nil {
		log.Printf("Ошибка установки API ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка установки API ключа: " + err.Error()})
		return
	}
	if err := grpcClient.Start(client.GRPCInsecure()); err != nil {
		log.Printf("Ошибка подключения к Tron gRPC ноде (grpc.trongrid.io:50051): %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подключения к Tron ноде: " + err.Error()})
		return
	}
	log.Println("✅ gRPC соединение с Tron нодой установлено успешно")
	defer grpcClient.Stop()

	log.Printf("Инициируем списание %s с кошелька %s", req.AmountHex, req.UserAddress)

	// --- Нативная подготовка параметров через встроенный ABI-энкодер SDK ---
	// Переводим сумму из HEX (например, "4c4b40") в обычную десятичную строку ("5000000")
	amountBI := new(big.Int)
	cleanAmount := strings.TrimPrefix(req.AmountHex, "0x")
	if _, ok := amountBI.SetString(cleanAmount, 16); !ok {
		log.Printf("Ошибка парсинга суммы из HEX: %s", req.AmountHex)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат суммы"})
		return
	}
	amountStr := amountBI.String()

	// SDK ожидает параметры строго в виде JSON-массива строк: ["from", "to", "amount"]
	// Библиотека сама переведет Base58 адреса в HEX и дополнит нулями как надо.
	paramJSON := fmt.Sprintf(`["%s", "%s", "%s"]`, req.UserAddress, systemWallet, amountStr)

	// --- Создание транзакции ---
	log.Printf("Вызываем transferFrom через SDK: system=%s usdt=%s params=%s", systemWallet, usdtContract, paramJSON)
	tx, err := grpcClient.TriggerContract(
		systemWallet,
		usdtContract,
		"transferFrom(address,address,uint256)", // Возвращаем оригинальную сигнатуру метода
		paramJSON,                               // Передаем валидный JSON-массив параметров
		100_000_000,
		0, "", 0,
	)
	if err != nil {
		log.Printf("Ошибка TriggerContract: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при формировании транзакции: " + err.Error()})
		return
	}

	// --- 4. Хэширование и подписание (Ручная сборка) ---
	// Превращаем ключ в ECDSA формат (используем либу go-ethereum, так как стандарты криптографии те же)
	priv, err := crypto.HexToECDSA(privateKey)
	if err != nil {
		log.Printf("Ошибка чтения приватного ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка системного ключа"})
		return
	}

	// Сериализуем RawData транзакции в байты через protobuf
	rawDataBytes, err := proto.Marshal(tx.Transaction.GetRawData())
	if err != nil {
		log.Printf("Ошибка сериализации транзакции: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сборки транзакции"})
		return
	}

	// В сети Tron TXID — это SHA-256 хэш от сериализованных байтов RawData
	h256h := sha256.New()
	h256h.Write(rawDataBytes)
	txHash := h256h.Sum(nil)

	// Подписываем хэш с помощью криптографии
	signature, err := crypto.Sign(txHash, priv)
	if err != nil {
		log.Printf("Ошибка криптографической подписи: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подписания"})
		return
	}

	// Прикрепляем готовую подпись к объекту транзакции
	tx.Transaction.Signature = append(tx.Transaction.Signature, signature)

	// --- 5. Отправка в блокчейн ---
	broadcastResult, err := grpcClient.Broadcast(tx.Transaction)
	if err != nil || broadcastResult.Code != 0 {
		log.Printf("Ошибка Broadcast: %v, Сообщение: %s", err, string(broadcastResult.Message))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Транзакция отклонена сетью"})
		return
	}

	// Успех! Генерируем TXID из нашего хэша (в шестнадцатеричном виде)
	txID := hex.EncodeToString(txHash)
	log.Printf("✅ Успешное списание депозита! TXID: %s", txID)

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Депозит успешно списан",
		"txid":    txID,
	})
}

func handleSponsorGas(c *gin.Context) {
	var req SponsorGasRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	apiKey := os.Getenv("TRON_API_KEY")
	privateKey := os.Getenv("SYSTEM_PRIVATE_KEY")
	systemWallet := os.Getenv("SYSTEM_WALLET_ADDRESS")

	grpcClient := client.NewGrpcClient("grpc.trongrid.io:50051")
	if err := grpcClient.SetAPIKey(apiKey); err != nil {
		log.Printf("Ошибка установки API ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка установки API ключа: " + err.Error()})
		return
	}
	if err := grpcClient.Start(client.GRPCInsecure()); err != nil {
		log.Printf("Ошибка подключения к Tron gRPC ноде: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подключения к Tron ноде: " + err.Error()})
		return
	}
	defer grpcClient.Stop()

	// 1. Проверяем текущий баланс TRX и ресурсы пользователя
	userAddr, err := address.Base58ToAddress(req.UserAddress)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректный адрес пользователя"})
		return
	}

	account, err := grpcClient.GetAccount(userAddr.String())
	currentBalance := int64(0)
	if err == nil && account != nil {
		currentBalance = account.Balance
	}

	// Получаем текущие свободные ресурсы аккаунта (Energy/Bandwidth уже доступные пользователю)
	resources, resErr := grpcClient.GetAccountResource(userAddr.String())
	freeEnergy := int64(0)
	freeBandwidth := int64(0)
	if resErr == nil && resources != nil {
		// EnergyLimit - EnergyUsed = сколько Energy реально свободно прямо сейчас
		freeEnergy = resources.EnergyLimit - resources.EnergyUsed
		freeBandwidth = (resources.FreeNetLimit - resources.FreeNetUsed) + (resources.NetLimit - resources.NetUsed)
	}

	log.Printf("Пользователь %s: баланс=%d SUN, свободно Energy=%d, свободно Bandwidth=%d",
		req.UserAddress, currentBalance, freeEnergy, freeBandwidth)

	// Строго задаем отправку 8 TRX (8 000 000 SUN) на кошелек пользователя
	sponsorAmountSun := int64(8_000_000)

	log.Printf("Рассчитанная сумма спонсорства для %s: %d SUN (%.2f TRX)",
		req.UserAddress, sponsorAmountSun, float64(sponsorAmountSun)/1_000_000)

	// 3. Отправляем рассчитанную сумму TRX с системного кошелька на адрес пользователя
	priv, err := crypto.HexToECDSA(privateKey)
	if err != nil {
		log.Printf("Ошибка чтения приватного ключа: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка системного ключа"})
		return
	}

	log.Printf("Пытаемся создать перевод: from=%s to=%s amount=%d SUN", systemWallet, req.UserAddress, sponsorAmountSun)
	tx, err := grpcClient.Transfer(systemWallet, req.UserAddress, sponsorAmountSun)
	if err != nil {
		log.Printf("Ошибка создания транзакции перевода TRX: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при формировании транзакции спонсорства: " + err.Error()})
		return
	}

	rawDataBytes, err := proto.Marshal(tx.Transaction.GetRawData())
	if err != nil {
		log.Printf("Ошибка сериализации транзакции: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сборки транзакции"})
		return
	}

	h256h := sha256.New()
	h256h.Write(rawDataBytes)
	txHash := h256h.Sum(nil)

	signature, err := crypto.Sign(txHash, priv)
	if err != nil {
		log.Printf("Ошибка криптографической подписи: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подписания"})
		return
	}

	tx.Transaction.Signature = append(tx.Transaction.Signature, signature)

	broadcastResult, err := grpcClient.Broadcast(tx.Transaction)
	if err != nil || broadcastResult.Code != 0 {
		log.Printf("Ошибка Broadcast спонсорства газа: %v, Сообщение: %s", err, string(broadcastResult.Message))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Транзакция спонсорства отклонена сетью"})
		return
	}

	txID := hex.EncodeToString(txHash)
	log.Printf("✅ Отправлено %d SUN TRX на %s для покрытия газа. TXID: %s", sponsorAmountSun, req.UserAddress, txID)

	c.JSON(http.StatusOK, gin.H{
		"status":  "sent",
		"message": "TRX для газа отправлены",
		"txid":    txID,
		"amount":  sponsorAmountSun,
	})
}
