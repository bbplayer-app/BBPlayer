CREATE TABLE "playlist_members" (
	"playlist_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_members_playlist_id_user_id_pk" PRIMARY KEY("playlist_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shared_playlist_tracks" (
	"playlist_id" uuid NOT NULL,
	"track_unique_key" text NOT NULL,
	"sort_key" text NOT NULL,
	"added_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "shared_playlist_tracks_playlist_id_track_unique_key_pk" PRIMARY KEY("playlist_id","track_unique_key")
);
--> statement-breakpoint
CREATE TABLE "shared_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_url" text,
	"editor_invite_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shared_tracks" (
	"unique_key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist_name" text,
	"artist_id" text,
	"cover_url" text,
	"duration" integer,
	"bilibili_bvid" text NOT NULL,
	"bilibili_cid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"face" text,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_playlist_id_shared_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."shared_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_playlist_tracks" ADD CONSTRAINT "shared_playlist_tracks_playlist_id_shared_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."shared_playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_playlist_tracks" ADD CONSTRAINT "shared_playlist_tracks_track_unique_key_shared_tracks_unique_key_fk" FOREIGN KEY ("track_unique_key") REFERENCES "public"."shared_tracks"("unique_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_playlist_tracks" ADD CONSTRAINT "shared_playlist_tracks_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_playlists" ADD CONSTRAINT "shared_playlists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spt_playlist_updated_idx" ON "shared_playlist_tracks" USING btree ("playlist_id","updated_at");--> statement-breakpoint
CREATE INDEX "spt_playlist_deleted_idx" ON "shared_playlist_tracks" USING btree ("playlist_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "editor_invite_code_unq" ON "shared_playlists" USING btree ("editor_invite_code") WHERE "shared_playlists"."editor_invite_code" IS NOT NULL;