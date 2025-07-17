package main

import (
	"log"
	"os"

	"roomly/database"
	"roomly/routes"
)

func main() {
	// 初始化数据库
	database.InitDB()

	// 设置路由
	r := routes.SetupRoutes()

	// 获取端口，默认为8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}

	// 启动服务器
	log.Printf("服务器启动在端口 %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("服务器启动失败:", err)
	}
}
