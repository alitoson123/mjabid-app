import Foundation
import UIKit
import Capacitor

/// Display-only bridge, independent of the microphone and audio session.
@objc(ScreenAwakePlugin)
public final class ScreenAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenAwakePlugin"
    public let jsName = "ScreenAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)
    ]
    private var requested = false
    private var foreground = false
    private var observers: [NSObjectProtocol] = []
    private let ownerID = UUID()
    private static var currentOwner: UUID?

    public override func load() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            Self.currentOwner = self.ownerID
            let center = NotificationCenter.default
            for name in [UIApplication.willResignActiveNotification, UIApplication.didEnterBackgroundNotification] {
                self.observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                    self?.foreground = false
                    self?.apply()
                })
            }
            self.observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                self?.foreground = true
                self?.apply()
            })
            self.foreground = UIApplication.shared.applicationState == .active
            self.apply()
        }
    }

    private func apply() {
        guard Self.currentOwner == ownerID else { return }
        UIApplication.shared.isIdleTimerDisabled = requested && foreground && UIApplication.shared.applicationState == .active
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else { call.reject("A boolean screen state is required"); return }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("Screen bridge is unavailable"); return }
            self.requested = enabled
            self.apply()
            call.resolve(["enabled": UIApplication.shared.isIdleTimerDisabled])
        }
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        let departingOwner = ownerID
        DispatchQueue.main.async {
            if Self.currentOwner == departingOwner {
                UIApplication.shared.isIdleTimerDisabled = false
                Self.currentOwner = nil
            }
        }
    }
}
