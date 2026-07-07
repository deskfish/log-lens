"use client";

import type { ServiceNodeTree } from "@/lib/types";
import styles from "./ServiceNodeTree.module.css";

interface Props {
  tree: ServiceNodeTree[];
  selectedServices: string[];
  selectedNodes: string[];
  onToggleService: (service: string) => void;
  onToggleNode: (service: string, node: string) => void;
}

export function ServiceNodeTree({
  tree,
  selectedServices,
  selectedNodes,
  onToggleService,
  onToggleNode,
}: Props) {
  return (
    <aside className={styles.tree}>
      <h2 className={styles.title}>服务 / 节点</h2>
      {tree.length === 0 ? (
        <p className={styles.empty}>等待索引完成</p>
      ) : (
        <ul className={styles.list}>
          {tree.map((svc) => (
            <li key={svc.serviceName}>
              <label className={styles.service}>
                <input
                  type="checkbox"
                  checked={selectedServices.includes(svc.serviceName)}
                  onChange={() => onToggleService(svc.serviceName)}
                />
                <span>{svc.serviceName}</span>
                <span className={styles.count}>{svc.count}</span>
              </label>
              <ul>
                {svc.nodes.map((node) => (
                  <li key={`${svc.serviceName}-${node.nodeName}`}>
                    <label className={styles.node}>
                      <input
                        type="checkbox"
                        checked={selectedNodes.includes(`${svc.serviceName}::${node.nodeName}`)}
                        onChange={() => onToggleNode(svc.serviceName, node.nodeName)}
                      />
                      <span>{node.nodeName}</span>
                      <span className={styles.count}>{node.count}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
