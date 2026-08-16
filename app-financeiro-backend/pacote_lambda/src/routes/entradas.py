from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado, security_scheme
from psycopg.rows import dict_row
import psycopg
from src.schemas.entradas import EntradaCreate

router = APIRouter(prefix="/api/v1/entradas", tags=["Entradas"])

def calcular_ultimo_dia_util(ano: int, mes: int) -> date:
    """Calcula inteligentemente o último dia útil de um determinado mês e ano."""
    if mes == 12:
        proximo_mes = date(ano + 1, 1, 1)
    else:
        proximo_mes = date(ano, mes + 1, 1)
    
    ultimo_dia = proximo_mes - timedelta(days=1)
    
    if ultimo_dia.weekday() == 5:  # Sábado
        ultimo_dia -= timedelta(days=1)
    elif ultimo_dia.weekday() == 6:  # Domingo
        ultimo_dia -= timedelta(days=2)
        
    return ultimo_dia

def gerar_entradas_do_mes(usuario_id: str, ano: int, mes: int, conn):
    """
    Gera registros concretos (snapshots) a partir das fixas, 
    caso o mês ainda não tenha registros gravados.
    """
    # 1. Verifica se já existem entradas gravadas para este mês/ano
    with conn.cursor() as cur:
        cur.execute("""
            SELECT count(*) FROM entradas 
            WHERE usuario_id = %s 
            AND EXTRACT(YEAR FROM data_recebimento) = %s 
            AND EXTRACT(MONTH FROM data_recebimento) = %s
            AND regra_recorrencia = 'DATA_EXATA';
        """, (usuario_id, ano, mes))
        
        if cur.fetchone()[0] == 0:
            # 2. Se não existem, clona as 'FIXAS' como 'DATA_EXATA' (histórico imutável)
            # Para 'ULTIMO_DIA_UTIL', calculamos a data correta do mês
            data_ideal = calcular_ultimo_dia_util(ano, mes)
            
            cur.execute("""
                INSERT INTO entradas (usuario_id, descricao, valor, tipo_entrada, data_recebimento, regra_recorrencia, confirmada)
                SELECT usuario_id, descricao, valor, 'PONTUAL', %s, 'DATA_EXATA', false
                FROM entradas 
                WHERE usuario_id = %s AND regra_recorrencia = 'ULTIMO_DIA_UTIL';
            """, (data_ideal, usuario_id))
            conn.commit()

@router.get(
    "", 
    status_code=status.HTTP_200_OK,
    dependencies=[Security(security_scheme)]
)
def listar_entradas(
    ano: int = Query(..., description="Ano de referência (ex: 2026)"),
    mes: int = Query(..., ge=1, le=12, description="Mês de referência (1–12)"),
    usuario_id: str = Depends(obter_usuario_logado)
):
    """
    Retorna as entradas do mês respeitando a regra de recorrência individual de cada cadastro.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT id, descricao, valor, tipo_entrada, data_recebimento, confirmada, regra_recorrencia
                    FROM entradas
                    WHERE usuario_id = %s;
                """, (usuario_id,))
                
                registros = cur.fetchall()
                
        meses_fechados = {
            (e["data_recebimento"].year, e["data_recebimento"].month) 
            for e in registros if e["regra_recorrencia"] == "DATA_EXATA"
        }

        entradas_processadas = []
        
        for e in registros:
            tipo = e["tipo_entrada"]
            regra = e["regra_recorrencia"]
            data_original = e["data_recebimento"]
            
            # 2. Se for DATA_EXATA, só exibe se for o mês pedido
            if regra == "DATA_EXATA":
                if data_original.year == ano and data_original.month == mes:
                    data_calculada = data_original
                else:
                    continue
            
            # 3. Se for regra recorrente (ULTIMO_DIA_UTIL / DIA_FIXO)...
            else:
                # ... MAS SE ESSE MÊS JÁ TIVER UM SNAPSHOT, OMITIMOS O TEMPLATE
                if (ano, mes) in meses_fechados:
                    continue 
                
                # ... (resto da sua lógica de cálculo de data aqui) ...
                if regra == "ULTIMO_DIA_UTIL":
                    data_calculada = calcular_ultimo_dia_util(ano, mes)
                elif regra == "DIA_FIXO":
                    # ... sua lógica de dia fixo ...
                    data_calculada = date(ano, mes, data_original.day)
                else:
                    continue
            
            entradas_processadas.append({
                # ... (o seu append normal aqui)
                "id": str(e["id"]),
                "descricao": e["descricao"],
                "valor": float(e["valor"]),
                "tipo_entrada": tipo,
                "regra_recorrencia": regra,
                "data_recebimento": str(data_calculada),
                "confirmada": e["confirmada"]
            })

        entradas_processadas.sort(key=lambda x: x["data_recebimento"])

        total_confirmado = sum(e["valor"] for e in entradas_processadas if e["confirmada"])
        total_pendente = sum(e["valor"] for e in entradas_processadas if not e["confirmada"])

        return {
            "periodo": {"ano": ano, "mes": mes},
            "total_confirmado": total_confirmado,
            "total_pendente": total_pendente,
            "entradas": entradas_processadas
        }

    except psycopg.Error as erro:
        print(f"Falha técnica ao buscar entradas: {erro}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"codigo": "ERRO_BANCO", "mensagem": "Erro interno ao buscar entradas."}
        )

@router.post("", status_code=status.HTTP_201_CREATED)
def criar_entrada(
    entrada: EntradaCreate,
    usuario_id: str = Depends(obter_usuario_logado)
):
    """
    Cadastra uma nova entrada (fixa ou pontual) para o usuário autenticado.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO entradas (
                        usuario_id, descricao, valor, tipo_entrada, 
                        data_recebimento, regra_recorrencia, confirmada
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (
                    usuario_id, entrada.descricao, entrada.valor, 
                    entrada.tipo_entrada, entrada.data_recebimento, 
                    entrada.regra_recorrencia, entrada.confirmada
                ))
                novo_id = cur.fetchone()[0]
                conn.commit()
        
        return {"mensagem": "Entrada criada com sucesso", "id": str(novo_id)}

    except psycopg.Error as erro:
        print(f"Erro ao inserir entrada: {erro}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"mensagem": "Falha ao gravar no banco de dados."}
        )

@router.delete("/{entrada_id}", status_code=status.HTTP_200_OK)
def deletar_entrada(
    entrada_id: str,
    usuario_id: str = Depends(obter_usuario_logado)
):
    """
    Remove uma entrada específica pelo ID, garantindo que o usuário 
    seja o dono daquele registro.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # O WHERE usuario_id garante que o usuário só apague o que é dele
                cur.execute("""
                    DELETE FROM entradas 
                    WHERE id = %s AND usuario_id = %s
                    RETURNING id;
                """, (entrada_id, usuario_id))
                
                removido = cur.fetchone()
                conn.commit()
                
        if not removido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"mensagem": "Entrada não encontrada ou sem permissão para excluir."}
            )
            
        return {"mensagem": "Entrada deletada com sucesso"}

    except psycopg.Error as erro:
        print(f"Erro ao excluir entrada: {erro}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"mensagem": "Falha ao excluir a entrada no banco de dados."}
        )

from src.schemas.entradas import EntradaCreate, EntradaUpdate # Atualize seu import

@router.put("/{entrada_id}", status_code=status.HTTP_200_OK)
def editar_entrada(
    entrada_id: str,
    entrada: EntradaUpdate,
    usuario_id: str = Depends(obter_usuario_logado)
):
    """
    Atualiza uma entrada específica do usuário.
    """
    # Filtra apenas os campos que foram enviados (não nulos)
    dados_para_atualizar = {k: v for k, v in entrada.model_dump().items() if v is not None}
    
    if not dados_para_atualizar:
        raise HTTPException(status_code=400, detail="Nenhum campo fornecido para atualização.")

    # Constrói a query SQL dinamicamente
    campos = ", ".join([f"{k} = %s" for k in dados_para_atualizar.keys()])
    valores = list(dados_para_atualizar.values())
    valores.extend([entrada_id, usuario_id]) # Filtros WHERE

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE entradas 
                    SET {campos} 
                    WHERE id = %s AND usuario_id = %s
                    RETURNING id;
                """, tuple(valores))
                
                atualizado = cur.fetchone()
                conn.commit()

        if not atualizado:
            raise HTTPException(status_code=404, detail="Entrada não encontrada.")

        return {"mensagem": "Entrada atualizada com sucesso"}

    except psycopg.Error as erro:
        print(f"Erro ao atualizar: {erro}")
        raise HTTPException(status_code=500, detail="Falha ao atualizar no banco.")

@router.post("/fechar-mes", status_code=status.HTTP_201_CREATED)
def fechar_mes_atual(usuario_id: str = Depends(obter_usuario_logado)):
    """
    Grava o 'snapshot' de todas as entradas fixas no mês atual (agosto/2026).
    Isso congela o valor e a data para fins de histórico e auditoria.
    """
    ano_atual = 2026 # Pode ser dinâmico com date.today().year
    mes_atual = 8    # Pode ser dinâmico com date.today().month
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Verifica se já não fechamos este mês antes (para evitar duplicidade)
                cur.execute("""
                    SELECT count(*) FROM entradas 
                    WHERE usuario_id = %s 
                    AND EXTRACT(YEAR FROM data_recebimento) = %s 
                    AND EXTRACT(MONTH FROM data_recebimento) = %s
                    AND regra_recorrencia = 'DATA_EXATA';
                """, (usuario_id, ano_atual, mes_atual))
                
                if cur.fetchone()[0] > 0:
                    raise HTTPException(status_code=400, detail="Este mês já foi fechado.")

                # 2. Cria os snapshots
                data_calculada = calcular_ultimo_dia_util(ano_atual, mes_atual)
                
                cur.execute("""
                    INSERT INTO entradas (usuario_id, descricao, valor, tipo_entrada, data_recebimento, regra_recorrencia, confirmada)
                    SELECT usuario_id, descricao, valor, 'PONTUAL', %s, 'DATA_EXATA', false
                    FROM entradas 
                    WHERE usuario_id = %s AND tipo_entrada = 'FIXA';
                """, (data_calculada, usuario_id))
                
                conn.commit()
        
        return {"mensagem": f"Mês {mes_atual}/{ano_atual} fechado com sucesso. Histórico imutável gravado."}

    except psycopg.Error as erro:
        print(f"Erro ao fechar mês: {erro}")
        raise HTTPException(status_code=500, detail="Falha ao gravar histórico do mês.")