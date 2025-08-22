package routes

import (
	"roomly/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRoutes() *gin.Engine {
	r := gin.Default()

	// 配置CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(config))

	// API路由组
	api := r.Group("/api")
	{
		// 给用户发信息相关路由
		users := api.Group("/users")
		{
			users.GET("/basic", handlers.SendMessageToUsers)
			users.GET("/summary", handlers.SendMessageToUsers)
			users.POST("/summary", handlers.SendMeetingSummaryPost)
		}

		// 会员相关路由
		members := api.Group("/members")
		{
			members.GET("", handlers.GetMembers)
			members.GET("/:id", handlers.GetMember)
			members.GET("/:id/dootask", handlers.GetMemberForDootaskId)
			members.POST("", handlers.CreateMember)
			members.PUT("/:id", handlers.UpdateMember)
			members.DELETE("/:id", handlers.DeleteMember)
			members.PUT("/:id/admin", handlers.SetAdminPermission)
			members.PUT("/:id/room-admin", handlers.SetRoomAdminPermission)
			members.GET("/:id/bookings", handlers.GetMemberBookings)
		}

		// 会议室相关路由
		rooms := api.Group("/rooms")
		{
			rooms.GET("", handlers.GetRooms)
			rooms.GET("/open", handlers.GetOpenRooms)
			rooms.GET("/:id", handlers.GetRoom)
			rooms.POST("", handlers.CreateRoom)
			rooms.PUT("/:id", handlers.UpdateRoom)
			rooms.DELETE("/:id", handlers.DeleteRoom)
			rooms.PUT("/:id/toggle", handlers.ToggleRoomStatus)
			rooms.GET("/:id/bookings", handlers.GetRoomBookings)
		}

		// 预定相关路由
		bookings := api.Group("/bookings")
		{
			bookings.GET("", handlers.GetBookings)
			bookings.POST("", handlers.CreateBooking)
			bookings.PUT("/:id/cancel", handlers.CancelBooking)
			bookings.GET("/available-slots", handlers.GetAvailableSlots)
		}

		// 导出相关路由
		export := api.Group("/export")
		{
			export.GET("/bookings", handlers.ExportBookings)
			export.GET("/room-usage", handlers.ExportRoomUsage)
		}
	}

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Roomly API is running",
		})
	})

	return r
}
