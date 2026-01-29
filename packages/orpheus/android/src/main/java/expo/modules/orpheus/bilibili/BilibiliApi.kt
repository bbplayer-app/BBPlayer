package expo.modules.orpheus.bilibili

import retrofit2.Call
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query
import retrofit2.http.QueryMap

interface BilibiliApi {
    @GET("/x/web-interface/nav")
    fun getNavInfo(): Call<BilibiliNavResponse>

    @GET("/x/player/wbi/playurl")
    fun getPlayUrl(
        @Header("Cookie") cookie: String? = null,
        @QueryMap params: Map<String, String>
    ): Call<BilibiliApiResponse<BilibiliAudioStreamResponse>>

    @GET("/x/player/pagelist")
    fun getPageList(
        @Header("Cookie") cookie: String? = null,
        @Query("bvid") bvid: String
    ): Call<BilibiliApiResponse<List<BilibiliPageListResponse>>>
}