import { useEffect, useState } from 'react'

// Carrega dados de um sistema protegido. Se o gateway negar (403 "acesso_negado"),
// leva a pessoa para a Tela 4 com o motivo, o código da decisão etc.
export function useProtegido(chamar, go) {
  const [estado, setEstado] = useState({ carregando: true })
  useEffect(() => {
    let vivo = true
    chamar().then((r) => {
      if (!vivo) return
      if (r.status === 403 && r.dados?.erro === 'acesso_negado') return go('negado', r.dados)
      setEstado(
        r.ok
          ? { dados: r.dados }
          : { erro: r.status === 0 ? 'O gateway não respondeu. Ele está no ar?' : 'Não foi possível carregar os dados.' },
      )
    })
    return () => { vivo = false }
  }, [chamar, go])
  return estado
}
