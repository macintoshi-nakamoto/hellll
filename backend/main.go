package main

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
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

	// 3. Роут для приема сигнала на депозит
	r.POST("/api/deposit", handleDeposit)

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

	// Подключаемся к ноде Tron через gRPC
	grpcClient := client.NewGrpcClient("grpc.trongrid.io:50051")
	err := grpcClient.SetAPIKey(apiKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка установки API ключа"})
		return
	}
	if err := grpcClient.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка подключения к Tron ноде"})
		return
	}
	defer grpcClient.Stop()

	log.Printf("Инициируем списание %s с кошелька %s", req.AmountHex, req.UserAddress)

	// --- Низкоуровневая подготовка параметров ABI для transferFrom ---
	// Tron ожидает параметры в виде одной длинной hex-строки.
	// Каждое значение должно быть длиной ровно 64 символа (дополняется нулями слева).

	// 1. Конвертируем адрес пользователя (откуда списываем)
	userAddrByte, _ := address.Base58ToAddress(req.UserAddress)
	userHex := strings.TrimPrefix(userAddrByte.Hex(), "41")      // Убираем префикс сети Tron
	userHexPad := strings.Repeat("0", 64-len(userHex)) + userHex // Строго дополняем нулями

	// 2. Конвертируем наш системный адрес (куда зачисляем)
	sysAddrByte, _ := address.Base58ToAddress(systemWallet)
	sysHex := strings.TrimPrefix(sysAddrByte.Hex(), "41")
	sysHexPad := strings.Repeat("0", 64-len(sysHex)) + sysHex

	// 3. Форматируем сумму (фронтенд уже присылает HEX)
	amountClean := strings.TrimPrefix(req.AmountHex, "0x")
	amountHexPad := strings.Repeat("0", 64-len(amountClean)) + amountClean

	// Склеиваем параметры: transferFrom(address from, address to, uint256 amount)
	hexParams := userHexPad + sysHexPad + amountHexPad

	// --- Создание транзакции ---
	// 100_000_000 - это feeLimit (лимит энергии, оплачивает сервер)
	tx, err := grpcClient.TriggerContract(
		systemWallet,
		usdtContract,
		"transferFrom(address,address,uint256)",
		hexParams,
		100_000_000,
		0, "", 0,
	)
	if err != nil {
		log.Printf("Ошибка TriggerContract: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при формировании транзакции"})
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
