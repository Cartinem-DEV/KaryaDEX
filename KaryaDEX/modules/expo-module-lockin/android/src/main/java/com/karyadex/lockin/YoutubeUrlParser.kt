package com.karyadex.lockin

data class YoutubeParseResult(
    val channelId: String?,
    val channelName: String?,
    val isValid: Boolean
)

object YoutubeUrlParser {
    fun parse(url: String): YoutubeParseResult {
        if (url.isBlank()) {
            return YoutubeParseResult(null, null, false)
        }

        val lower = url.toLowerCase()

        // Handle @handle format - youtube.com/@handle
        val handleRegex = Regex("@([a-zA-Z0-9_-]+)")
        val handleMatch = handleRegex.find(lower)
        if (handleMatch != null) {
            val handle = handleMatch.groupValues[1]
            return YoutubeParseResult(
                channelId = handle,
                channelName = handle.capitalize(),
                isValid = true
            )
        }

        // Handle handle query parameter
        val handleParamRegex = Regex("[\\?&]handle=([^&\\s]+)")
        val handleParamMatch = handleParamRegex.find(lower)
        if (handleParamMatch != null) {
            val handle = handleParamMatch.groupValues[1].trimStart('@')
            return YoutubeParseResult(
                channelId = handle,
                channelName = handle.capitalize(),
                isValid = true
            )
        }

        // Channel ID format - youtube.com/channel/UC...
        val channelIdRegex = Regex("channel/([a-zA-Z0-9_-]{22})")
        val channelIdMatch = channelIdRegex.find(lower)
        if (channelIdMatch != null) {
            val channelId = channelIdMatch.groupValues[1]
            return YoutubeParseResult(
                channelId = channelId,
                channelName = "YouTube Channel",
                isValid = true
            )
        }

        // Vanity channel URL - youtube.com/c/...
        val cVanityRegex = Regex("c/([a-zA-Z0-9_-]+)")
        val cVanityMatch = cVanityRegex.find(lower)
        if (cVanityMatch != null) {
            val vanity = cVanityMatch.groupValues[1]
            return YoutubeParseResult(
                channelId = null,
                channelName = vanity.capitalize(),
                isValid = true
            )
        }

        // Short URL - youtu.be/...
        val shortUrlRegex = Regex("youtu\\.be/([a-zA-Z0-9_-]{11})")
        val shortUrlMatch = shortUrlRegex.find(lower)
        if (shortUrlMatch != null) {
            val videoId = shortUrlMatch.groupValues[1]
            return YoutubeParseResult(
                channelId = videoId,
                channelName = "YouTube Video",
                isValid = true
            )
        }

        // User URL - youtube.com/user/...
        val userRegex = Regex("user/([a-zA-Z0-9_-]+)")
        val userMatch = userRegex.find(lower)
        if (userMatch != null) {
            val username = userMatch.groupValues[1]
            return YoutubeParseResult(
                channelId = null,
                channelName = username.capitalize(),
                isValid = true
            )
        }

        return YoutubeParseResult(null, null, false)
    }
}
