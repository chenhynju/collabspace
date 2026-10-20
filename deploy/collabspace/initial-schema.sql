-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "ConversationMemberRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ConversationMemberStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "CommonStatus" AS ENUM ('NORMAL', 'DISABLED');

-- CreateEnum
CREATE TYPE "ShowHide" AS ENUM ('SHOW', 'HIDE');

-- CreateEnum
CREATE TYPE "MenuType" AS ENUM ('DIR', 'MENU', 'BUTTON');

-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('ALL', 'CUSTOM', 'DEPT', 'DEPT_AND_CHILD', 'SELF');

-- CreateEnum
CREATE TYPE "YesNo" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'GITHUB');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DELIVERED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('NOTICE', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "sys_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_user_oauth" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_user_oauth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_email_verification_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_email_verification_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_password_reset_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan_id" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "stripe_customer_id" TEXT,
    "paypal_subscription_id" TEXT,
    "checkout_attempt_id" TEXT,
    "checkout_provider" TEXT,
    "checkout_plan_key" TEXT,
    "checkout_session_id" TEXT,
    "checkout_url" TEXT,
    "checkout_expires_at" TIMESTAMP(3),

    CONSTRAINT "org_organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_workspace" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_membership" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dept_id" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_menu" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "menu_name" TEXT NOT NULL,
    "type" "MenuType" NOT NULL DEFAULT 'MENU',
    "order_num" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "component" TEXT,
    "query" TEXT,
    "route_name" TEXT,
    "is_frame" BOOLEAN NOT NULL DEFAULT false,
    "is_cache" BOOLEAN NOT NULL DEFAULT false,
    "visible" "ShowHide" NOT NULL DEFAULT 'SHOW',
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "perms" TEXT,
    "icon" TEXT DEFAULT '#',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_role" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "data_scope" "DataScope" NOT NULL DEFAULT 'SELF',
    "menu_check_strictly" BOOLEAN NOT NULL DEFAULT true,
    "dept_check_strictly" BOOLEAN NOT NULL DEFAULT true,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_role_menu" (
    "role_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,

    CONSTRAINT "sys_role_menu_pkey" PRIMARY KEY ("role_id","menu_id")
);

-- CreateTable
CREATE TABLE "sys_role_dept" (
    "role_id" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,

    CONSTRAINT "sys_role_dept_pkey" PRIMARY KEY ("role_id","dept_id")
);

-- CreateTable
CREATE TABLE "org_membership_role" (
    "membership_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "org_membership_role_pkey" PRIMARY KEY ("membership_id","role_id")
);

-- CreateTable
CREATE TABLE "sys_dept" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "ancestors" TEXT NOT NULL DEFAULT '',
    "dept_name" TEXT NOT NULL,
    "order_num" INTEGER NOT NULL DEFAULT 0,
    "leader" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_dept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_post" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "post_code" TEXT NOT NULL,
    "post_name" TEXT NOT NULL,
    "post_sort" INTEGER NOT NULL DEFAULT 0,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_membership_post" (
    "membership_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,

    CONSTRAINT "org_membership_post_pkey" PRIMARY KEY ("membership_id","post_id")
);

-- CreateTable
CREATE TABLE "org_invitation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by" TEXT NOT NULL,
    "accepted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "org_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prj_project" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prj_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab_document" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "acl_epoch" INTEGER NOT NULL DEFAULT 1,
    "seq" BIGINT NOT NULL DEFAULT 0,
    "state" BYTEA NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab_grant" (
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "collab_grant_pkey" PRIMARY KEY ("document_id","user_id")
);

-- CreateTable
CREATE TABLE "collab_update" (
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "update_id" UUID NOT NULL,
    "seq" BIGINT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_update_pkey" PRIMARY KEY ("document_id","update_id")
);

-- CreateTable
CREATE TABLE "collab_ticket" (
    "hash" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,

    CONSTRAINT "collab_ticket_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "collab_thread" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "quote" TEXT NOT NULL DEFAULT '',
    "anchor" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab_reply" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "thread_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab_version" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "state" BYTEA NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab_restore" (
    "id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_id" UUID NOT NULL,
    "actor_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,

    CONSTRAINT "collab_restore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prj_task" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_id" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prj_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prj_file" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prj_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prj_file_share" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "shared_with_user_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prj_file_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2) NOT NULL,
    "seats_included" INTEGER NOT NULL,
    "ai_credits" INTEGER NOT NULL,
    "max_projects" INTEGER NOT NULL,
    "storage_gb" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "bill_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_subscription" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sandbox',
    "external_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_collaboration_group" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_collaboration_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_group_member" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "org_group_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_resource_grant" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "access" TEXT NOT NULL,

    CONSTRAINT "org_resource_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_entitlement" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "seats_included" INTEGER NOT NULL,
    "ai_credits_total" INTEGER NOT NULL,
    "ai_credits_used" INTEGER NOT NULL DEFAULT 0,
    "max_projects" INTEGER NOT NULL,
    "storage_gb" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_billing_event" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_billing_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_dict_type" (
    "id" TEXT NOT NULL,
    "dict_name" TEXT NOT NULL,
    "dict_type" TEXT NOT NULL,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_dict_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_dict_data" (
    "id" TEXT NOT NULL,
    "dict_sort" INTEGER NOT NULL DEFAULT 0,
    "dict_label" TEXT NOT NULL,
    "dict_value" TEXT NOT NULL,
    "dict_type" TEXT NOT NULL,
    "css_class" TEXT,
    "list_class" TEXT,
    "is_default" "YesNo" NOT NULL DEFAULT 'NO',
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_dict_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_config" (
    "id" TEXT NOT NULL,
    "config_name" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "config_type" "YesNo" NOT NULL DEFAULT 'NO',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_notice" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "notice_title" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL DEFAULT 'NOTICE',
    "notice_content" TEXT NOT NULL,
    "status" "CommonStatus" NOT NULL DEFAULT 'NORMAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_notice_read" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_notice_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "im_conversation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "title" TEXT,
    "direct_key" TEXT,
    "created_by_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "im_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "im_conversation_member" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "ConversationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_read_message_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "im_conversation_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "im_message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "attachment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "im_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "im_message_attachment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "im_message_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_oper_log" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "title" TEXT NOT NULL,
    "business_type" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT,
    "request_method" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "trace_id" TEXT NOT NULL,
    "ip" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "cost_time" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_oper_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_login_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" TEXT NOT NULL,
    "ip" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_login_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_outbox" (
    "id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "sys_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_email_key" ON "sys_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sys_user_oauth_provider_provider_user_id_key" ON "sys_user_oauth"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_email_verification_token_token_hash_key" ON "sys_email_verification_token"("token_hash");

-- CreateIndex
CREATE INDEX "sys_email_verification_token_user_id_idx" ON "sys_email_verification_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_password_reset_token_token_hash_key" ON "sys_password_reset_token"("token_hash");

-- CreateIndex
CREATE INDEX "sys_password_reset_token_user_id_idx" ON "sys_password_reset_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_organization_slug_key" ON "org_organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_organization_stripe_customer_id_key" ON "org_organization"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_organization_paypal_subscription_id_key" ON "org_organization"("paypal_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_workspace_organization_id_name_key" ON "org_workspace"("organization_id", "name");

-- CreateIndex
CREATE INDEX "org_membership_organization_id_status_idx" ON "org_membership"("organization_id", "status");

-- CreateIndex
CREATE INDEX "org_membership_dept_id_idx" ON "org_membership"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_membership_organization_id_user_id_key" ON "org_membership"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "sys_menu_parent_id_idx" ON "sys_menu"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_role_organization_id_role_key_key" ON "sys_role"("organization_id", "role_key");

-- CreateIndex
CREATE INDEX "org_membership_role_role_id_idx" ON "org_membership_role"("role_id");

-- CreateIndex
CREATE INDEX "sys_dept_parent_id_idx" ON "sys_dept"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dept_organization_id_dept_name_key" ON "sys_dept"("organization_id", "dept_name");

-- CreateIndex
CREATE UNIQUE INDEX "sys_post_organization_id_post_code_key" ON "sys_post"("organization_id", "post_code");

-- CreateIndex
CREATE INDEX "org_membership_post_post_id_idx" ON "org_membership_post"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_invitation_token_hash_key" ON "org_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "org_invitation_organization_id_email_idx" ON "org_invitation"("organization_id", "email");

-- CreateIndex
CREATE INDEX "prj_project_organization_id_workspace_id_idx" ON "prj_project"("organization_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "prj_project_org_id_key" ON "prj_project"("organization_id", "id");

-- CreateIndex
CREATE INDEX "collab_document_project" ON "collab_document"("organization_id", "project_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "collab_document_organization_id_id_key" ON "collab_document"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "collab_update_document_id_seq_key" ON "collab_update"("document_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "collab_thread_organization_id_document_id_id_key" ON "collab_thread"("organization_id", "document_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_plan_code_key" ON "bill_plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bill_subscription_external_id_key" ON "bill_subscription"("external_id");

-- CreateIndex
CREATE INDEX "org_collaboration_group_organization_id_idx" ON "org_collaboration_group"("organization_id");

-- CreateIndex
CREATE INDEX "org_group_member_organization_id_idx" ON "org_group_member"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_group_member_group_id_membership_id_key" ON "org_group_member"("group_id", "membership_id");

-- CreateIndex
CREATE INDEX "org_resource_grant_organization_id_idx" ON "org_resource_grant"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_resource_grant_group_id_project_id_key" ON "org_resource_grant"("group_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_entitlement_organization_id_key" ON "bill_entitlement"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_billing_event_provider_event_id_key" ON "bill_billing_event"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dict_type_dict_type_key" ON "sys_dict_type"("dict_type");

-- CreateIndex
CREATE INDEX "sys_dict_data_dict_type_idx" ON "sys_dict_data"("dict_type");

-- CreateIndex
CREATE UNIQUE INDEX "sys_config_config_key_key" ON "sys_config"("config_key");

-- CreateIndex
CREATE INDEX "sys_notice_organization_id_idx" ON "sys_notice"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_notice_read_notice_id_user_id_key" ON "sys_notice_read"("notice_id", "user_id");

-- CreateIndex
CREATE INDEX "im_conversation_organization_id_last_message_at_idx" ON "im_conversation"("organization_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "im_conversation_organization_id_direct_key_key" ON "im_conversation"("organization_id", "direct_key");

-- CreateIndex
CREATE INDEX "im_conversation_member_organization_id_user_id_status_idx" ON "im_conversation_member"("organization_id", "user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "im_conversation_member_conversation_id_user_id_key" ON "im_conversation_member"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "im_message_conversation_id_created_at_idx" ON "im_message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "im_message_organization_id_created_at_idx" ON "im_message"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "sys_oper_log_organization_id_created_at_idx" ON "sys_oper_log"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "sys_oper_log_resource_type_resource_id_idx" ON "sys_oper_log"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "sys_login_log_created_at_idx" ON "sys_login_log"("created_at");

-- CreateIndex
CREATE INDEX "sys_outbox_status_created_at_idx" ON "sys_outbox"("status", "created_at");

-- AddForeignKey
ALTER TABLE "sys_user_oauth" ADD CONSTRAINT "sys_user_oauth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_email_verification_token" ADD CONSTRAINT "sys_email_verification_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_password_reset_token" ADD CONSTRAINT "sys_password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_organization" ADD CONSTRAINT "org_organization_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "bill_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_workspace" ADD CONSTRAINT "org_workspace_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "sys_dept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_menu" ADD CONSTRAINT "sys_menu_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sys_menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role" ADD CONSTRAINT "sys_role_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role_menu" ADD CONSTRAINT "sys_role_menu_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role_menu" ADD CONSTRAINT "sys_role_menu_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "sys_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role_dept" ADD CONSTRAINT "sys_role_dept_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_role_dept" ADD CONSTRAINT "sys_role_dept_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "sys_dept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership_role" ADD CONSTRAINT "org_membership_role_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "org_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership_role" ADD CONSTRAINT "org_membership_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_dept" ADD CONSTRAINT "sys_dept_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_dept" ADD CONSTRAINT "sys_dept_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sys_dept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_post" ADD CONSTRAINT "sys_post_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership_post" ADD CONSTRAINT "org_membership_post_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "org_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership_post" ADD CONSTRAINT "org_membership_post_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "sys_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invitation" ADD CONSTRAINT "org_invitation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invitation" ADD CONSTRAINT "org_invitation_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "sys_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invitation" ADD CONSTRAINT "org_invitation_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invitation" ADD CONSTRAINT "org_invitation_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "sys_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_project" ADD CONSTRAINT "prj_project_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_project" ADD CONSTRAINT "prj_project_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "org_workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_project" ADD CONSTRAINT "prj_project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_document" ADD CONSTRAINT "collab_document_organization_id_project_id_fkey" FOREIGN KEY ("organization_id", "project_id") REFERENCES "prj_project"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_grant" ADD CONSTRAINT "collab_grant_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_update" ADD CONSTRAINT "collab_update_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_ticket" ADD CONSTRAINT "collab_ticket_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_thread" ADD CONSTRAINT "collab_thread_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_reply" ADD CONSTRAINT "collab_reply_organization_id_document_id_thread_id_fkey" FOREIGN KEY ("organization_id", "document_id", "thread_id") REFERENCES "collab_thread"("organization_id", "document_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_version" ADD CONSTRAINT "collab_version_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_restore" ADD CONSTRAINT "collab_restore_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_restore" ADD CONSTRAINT "collab_restore_organization_id_result_id_fkey" FOREIGN KEY ("organization_id", "result_id") REFERENCES "collab_document"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_task" ADD CONSTRAINT "prj_task_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_task" ADD CONSTRAINT "prj_task_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "prj_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_task" ADD CONSTRAINT "prj_task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "sys_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_file" ADD CONSTRAINT "prj_file_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_file" ADD CONSTRAINT "prj_file_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "prj_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_file" ADD CONSTRAINT "prj_file_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_file_share" ADD CONSTRAINT "prj_file_share_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prj_file_share" ADD CONSTRAINT "prj_file_share_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "prj_file"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_subscription" ADD CONSTRAINT "bill_subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_subscription" ADD CONSTRAINT "bill_subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "bill_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_group_member" ADD CONSTRAINT "org_group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "org_collaboration_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_group_member" ADD CONSTRAINT "org_group_member_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "org_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_resource_grant" ADD CONSTRAINT "org_resource_grant_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "org_collaboration_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_resource_grant" ADD CONSTRAINT "org_resource_grant_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "prj_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_entitlement" ADD CONSTRAINT "bill_entitlement_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_entitlement" ADD CONSTRAINT "bill_entitlement_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "bill_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_billing_event" ADD CONSTRAINT "bill_billing_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_dict_data" ADD CONSTRAINT "sys_dict_data_dict_type_fkey" FOREIGN KEY ("dict_type") REFERENCES "sys_dict_type"("dict_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notice" ADD CONSTRAINT "sys_notice_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_notice_read" ADD CONSTRAINT "sys_notice_read_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "sys_notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_conversation" ADD CONSTRAINT "im_conversation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_conversation" ADD CONSTRAINT "im_conversation_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_conversation_member" ADD CONSTRAINT "im_conversation_member_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "im_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_conversation_member" ADD CONSTRAINT "im_conversation_member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_conversation_member" ADD CONSTRAINT "im_conversation_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message" ADD CONSTRAINT "im_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "im_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message" ADD CONSTRAINT "im_message_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message" ADD CONSTRAINT "im_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message" ADD CONSTRAINT "im_message_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "im_message_attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message_attachment" ADD CONSTRAINT "im_message_attachment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message_attachment" ADD CONSTRAINT "im_message_attachment_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "im_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_message_attachment" ADD CONSTRAINT "im_message_attachment_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "sys_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_oper_log" ADD CONSTRAINT "sys_oper_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "org_organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_oper_log" ADD CONSTRAINT "sys_oper_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "sys_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

