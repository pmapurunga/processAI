/**
 * Utilitário para converter a estrutura JSON da API do Google Docs em Markdown.
 * Preserva a hierarquia de títulos, listas e a estrutura de tabelas.
 */
export class GoogleDocsUtils {

    /**
     * Extrai o ID do ficheiro a partir da URL do Google Docs.
     * Suporta formatos: /document/d/ID/edit ou /document/d/ID
     */
    static extractFileId(url: string): string | null {
      const match = url.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    }
  
    /**
     * Converte o objeto 'document' retornado pela API do Google Docs em uma string Markdown.
     */
    static convertToMarkdown(document: any): string {
      if (!document || !document.body || !document.body.content) {
        return '';
      }
  
      let markdown = '';
      const content = document.body.content;
  
      content.forEach((item: any) => {
        // 1. Processar Parágrafos e Títulos
        if (item.paragraph) {
          const style = item.paragraph.paragraphStyle?.namedStyleType;
          
          // Junta os elementos de texto do parágrafo
          let text = item.paragraph.elements
            ?.map((e: any) => e.textRun ? e.textRun.content : '')
            .join('')
            .replace(/\n$/, ''); // Remove quebra de linha extra do final
  
          // Ignora parágrafos vazios, a menos que sejam intencionais (ex: separação)
          if (!text || text.trim() === '') return;
  
          // Aplica formatação Markdown baseada no estilo do Google Docs
          switch (style) {
            case 'HEADING_1':
              markdown += `# ${text}\n\n`;
              break;
            case 'HEADING_2':
              markdown += `## ${text}\n\n`;
              break;
            case 'HEADING_3':
              markdown += `### ${text}\n\n`;
              break;
            case 'HEADING_4':
              markdown += `#### ${text}\n\n`;
              break;
            default:
              // Verifica se é uma lista (bullet points)
              if (item.paragraph.bullet) {
                markdown += `- ${text}\n`;
              } else {
                // Texto normal
                markdown += `${text}\n\n`;
              }
          }
        }
        
        // 2. Processar Tabelas (Crucial para manter a estrutura visual)
        else if (item.table) {
          markdown += this.processTable(item.table);
        }
      });
  
      return markdown;
    }
  
    /**
     * Processa uma tabela do Google Docs e converte para Markdown Table.
     */
    private static processTable(table: any): string {
      let tableMd = '\n';
      const rows = table.tableRows;
  
      if (!rows || rows.length === 0) return '';
  
      rows.forEach((row: any, rowIndex: number) => {
        const cells = row.tableCells;
        
        // Cria a linha da tabela com o conteúdo das células
        const rowContent = cells.map((cell: any) => {
          return this.getCellContent(cell);
        }).join(' | ');
  
        tableMd += `| ${rowContent} |\n`;
  
        // Se for a primeira linha (cabeçalho), adiciona o separador padrão do Markdown
        if (rowIndex === 0) {
          const separator = cells.map(() => '---').join(' | ');
          tableMd += `| ${separator} |\n`;
        }
      });
  
      return tableMd + '\n';
    }
  
    /**
     * Auxiliar para extrair texto limpo de dentro de uma célula de tabela.
     */
    private static getCellContent(cell: any): string {
      if (!cell.content) return '';
      
      return cell.content
        .map((c: any) => {
          if (c.paragraph && c.paragraph.elements) {
            return c.paragraph.elements
              .map((e: any) => e.textRun ? e.textRun.content.replace(/\n/g, ' ').trim() : '')
              .join('');
          }
          return '';
        })
        .join(' ');
    }
  }