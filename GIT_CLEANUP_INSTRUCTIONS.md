# Removendo deploy.sh do GitHub e Histórico

## Passo 1: Remover do Repositório (Mantendo local)
Como já adicionamos o arquivo ao `.gitignore`, agora precisamos removê-lo do "índice" do Git (a lista de arquivos rastreados).
Execute estes comandos no terminal, na raiz do projeto (`/Volumes/SSD Externo/Playground/processAI`):

```bash
git rm --cached backend_cloud_run/deploy.sh
git commit -m "chore: stop tracking deploy.sh"
git push
```

Isso remove o arquivo da versão *atual* do GitHub, mas ele ainda existirá no *histórico* de commits anteriores.

## Passo 2: Limpar Histórico do Git (Essencial para Segurança)
Como o arquivo continha uma chave de API, é importante removê-lo de todo o histórico.

> **⚠️ AVISO:** Esses procedimentos alteram o histórico do repositório. Se houver outros colaboradores, eles terão que clonar o repositório novamente.

### Opção Recomendada: Usando BFG Repo-Cleaner
O BFG é uma ferramenta simples e rápida para isso.

1. **Instale o BFG** (usando Homebrew no Mac):
   ```bash
   brew install bfg
   ```

2. **Remova o arquivo do histórico**:
   ```bash
   bfg --delete-files deploy.sh
   ```

3. **Limpe os objetos antigos do Git**:
   ```bash
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```

4. **Atualize o GitHub**:
   ```bash
   git push --force
   ```

### Opção Alternativa: Usando git filter-branch (Nativo, mas mais lento)
Se não quiser instalar o BFG, use o comando nativo do git (atenção à sintaxe exata):

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend_cloud_run/deploy.sh" \
  --prune-empty --tag-name-filter cat -- --all
```

Depois, force o push:
```bash
git push --force
```

## Passo 3: Rotacionar a Chave API (Já realizado)
Como você já gerou uma nova chave API (`AIzaSy...Mg`), o passo mais crítico já foi feito. A limpeza do histórico é para evitar que a chave antiga (mesmo que revogada/inválida) fique visível.
