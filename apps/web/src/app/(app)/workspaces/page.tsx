import { redirect } from "next/navigation";

/** 工作区不再单独占一个导航入口；保留旧地址，统一到项目空间的工作区管理面板。 */
export default function WorkspacesRedirect() {
  redirect("/projects?panel=workspaces");
}
