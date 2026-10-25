"""Radio channel model and random deployment of co-channel 5G small-cell links.

Path loss follows 3GPP TR 38.901 Urban-Micro (street canyon, LOS):
    PL(dB) = 32.4 + 21 log10(d[m]) + 20 log10(fc[GHz])
plus log-normal shadowing and Rayleigh (exponential power) small-scale fading.
"""

from dataclasses import dataclass

import numpy as np

NOISE_PSD_DBM_HZ = -174.0


def db_to_lin(x_db):
    return 10.0 ** (np.asarray(x_db) / 10.0)


def lin_to_db(x):
    return 10.0 * np.log10(np.asarray(x))


def dbm_to_watt(x_dbm):
    return 10.0 ** ((np.asarray(x_dbm) - 30.0) / 10.0)


def path_loss_db(d_m, fc_ghz):
    """3GPP TR 38.901 UMi street-canyon LOS path loss (d clipped at 1 m)."""
    d = np.maximum(np.asarray(d_m, dtype=float), 1.0)
    return 32.4 + 21.0 * np.log10(d) + 20.0 * np.log10(fc_ghz)


def noise_power_w(bandwidth_hz, noise_figure_db=7.0):
    """Thermal noise power over the band, including receiver noise figure."""
    return float(dbm_to_watt(NOISE_PSD_DBM_HZ + 10.0 * np.log10(bandwidth_hz) + noise_figure_db))


@dataclass
class Network:
    """A set of N transmitter -> receiver links sharing one channel.

    gains[i, j] is the power gain from transmitter j to receiver i, so the
    diagonal holds the desired-link gains and off-diagonals are interference.
    """

    gains: np.ndarray
    noise_w: float
    bandwidth_hz: float
    tx_pos: np.ndarray
    rx_pos: np.ndarray
    fc_ghz: float

    @property
    def n(self):
        return self.gains.shape[0]

    @property
    def bandwidth_mhz(self):
        return self.bandwidth_hz / 1e6


def deploy_links(n_links, area_m=300.0, link_range_m=(15.0, 60.0), fc_ghz=3.5,
                 bandwidth_hz=20e6, shadowing_db=4.0, noise_figure_db=7.0, rng=None):
    """Drop n_links small-cell links uniformly in a square area.

    Defaults model a 5G NR n78 (3.5 GHz) carrier of 20 MHz shared by
    co-located small cells / private networks.
    """
    rng = np.random.default_rng(rng)
    tx = rng.uniform(0.0, area_m, size=(n_links, 2))
    dist = rng.uniform(*link_range_m, size=n_links)
    theta = rng.uniform(0.0, 2.0 * np.pi, size=n_links)
    rx = tx + np.column_stack([dist * np.cos(theta), dist * np.sin(theta)])

    # d[i, j] = distance from transmitter j to receiver i
    d = np.linalg.norm(rx[:, None, :] - tx[None, :, :], axis=2)
    pl_db = path_loss_db(d, fc_ghz) + rng.normal(0.0, shadowing_db, size=d.shape)
    fading = rng.exponential(1.0, size=d.shape)
    gains = db_to_lin(-pl_db) * fading

    return Network(gains=gains, noise_w=noise_power_w(bandwidth_hz, noise_figure_db),
                   bandwidth_hz=bandwidth_hz, tx_pos=tx, rx_pos=rx, fc_ghz=fc_ghz)


def mqam_spectral_efficiency(snr_db, target_ber=1e-4):
    """Spectral efficiency (bit/s/Hz) of adaptive M-QAM at a target BER.

    Uses the Goldsmith approximation  k = log2(1 + K*SNR),  K = 1.5 / ln(0.2/BER).
    """
    K = 1.5 / np.log(0.2 / target_ber)
    return np.log2(1.0 + K * db_to_lin(snr_db))
